"use client";

import {
  decideSyncAction,
  expectedPositionMs,
  type PlaybackState,
  type Provider,
  type Track,
} from "@simultaneous/core";
import { createDeezerClient, createSpotifyClient, resolveTrack } from "@simultaneous/catalog";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSpotifyToken, isSpotifyConnected, spotifyConfigured, startSpotifyLogin } from "@/lib/spotify-auth";
import { SpotifyConnectAdapter } from "@/lib/spotify-player";
import { displayNameOf, getCurrentUser, getSupabase } from "@/lib/supabase";

interface Member {
  user_id: string;
  provider: Provider;
  display_name: string;
}
interface QueueItem extends Track {
  id: string;
  position: number;
}

const deezerApi = createDeezerClient("/api/deezer");
const spotifyApi = createSpotifyClient(getSpotifyToken);
const spotifyPlayer = new SpotifyConnectAdapter();
const IDLE: PlaybackState = { queueItemId: null, isPlaying: false, positionMs: 0, serverTs: 0 };

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function rowToItem(r: Record<string, unknown>): QueueItem {
  return {
    id: r.id as string,
    position: r.position as number,
    isrc: r.isrc as string,
    title: r.title as string,
    artist: r.artist as string,
    durationMs: r.duration_ms as number,
    spotifyId: (r.spotify_id as string | null) ?? undefined,
    deezerId: (r.deezer_id as string | null) ?? undefined,
  };
}

export function Room({ code }: { code: string }) {
  const router = useRouter();
  const pParam = useSearchParams().get("p");
  const provider: Provider = pParam === "deezer" ? "deezer" : "spotify";

  const [userId, setUserId] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [allowGuests, setAllowGuests] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [playback, setPlayback] = useState<PlaybackState>(IDLE);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [spotifyReady, setSpotifyReady] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const playbackRef = useRef<PlaybackState>(IDLE);
  const offsetRef = useRef(Number.NEGATIVE_INFINITY);
  const localRef = useRef<{ itemId: string | null; playing: boolean }>({ itemId: null, playing: false });
  const isHostRef = useRef(false);

  queueRef.current = queue;
  isHostRef.current = isHost;

  /** Aplica o estado do host ao player automatico deste aparelho (Spotify). */
  const applyToPlayer = useCallback(
    async (state: PlaybackState) => {
      if (provider !== "spotify" || !isSpotifyConnected()) return;
      const clockOffset = Number.isFinite(offsetRef.current) ? offsetRef.current : 0;
      try {
        const sameItem = localRef.current.itemId === state.queueItemId;
        const position = sameItem && localRef.current.playing ? await spotifyPlayer.getPositionMs() : null;
        const action = decideSyncAction({
          state,
          localNow: Date.now(),
          clockOffset,
          currentQueueItemId: localRef.current.itemId,
          currentIsPlaying: localRef.current.playing,
          currentPositionMs: position,
        });
        if (action.type === "play") {
          const item = queueRef.current.find((q) => q.id === state.queueItemId);
          if (!item) {
            setNotice("Faixa ainda nao carregada na fila; aguarde um instante.");
            return;
          }
          let track: Track = item;
          if (!track.spotifyId && track.isrc) {
            track = (await spotifyApi.getByIsrc(track.isrc)) ?? track;
          }
          if (!track.spotifyId) {
            setNotice(`"${item.title}" nao existe no Spotify - pulando para voce.`);
            return;
          }
          await spotifyPlayer.play(track, action.positionMs);
          localRef.current = { itemId: state.queueItemId, playing: true };
        } else if (action.type === "pause") {
          await spotifyPlayer.pause();
          localRef.current = { ...localRef.current, playing: false };
        } else if (action.type === "seek") {
          await spotifyPlayer.seek(action.positionMs);
        }
        setNotice("");
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "Falha ao controlar o Spotify.");
      }
    },
    [provider],
  );

  const receiveState = useCallback(
    (state: PlaybackState, fromHost: boolean) => {
      if (fromHost) {
        // amostra de offset do relogio: a de menor latencia (maior valor) vence.
        offsetRef.current = Math.max(offsetRef.current, state.serverTs - Date.now());
      }
      playbackRef.current = state;
      setPlayback(state);
      void applyToPlayer(state);
    },
    [applyToPlayer],
  );

  const publish = useCallback(
    async (state: PlaybackState) => {
      offsetRef.current = 0; // o host e a referencia
      playbackRef.current = state;
      setPlayback(state);
      void applyToPlayer(state);
      await channelRef.current?.send({ type: "broadcast", event: "state", payload: state });
      await getSupabase().from("rooms").update({ state }).eq("code", code);
    },
    [applyToPlayer, code],
  );

  const refetchQueue = useCallback(async () => {
    const { data } = await getSupabase()
      .from("queue_items")
      .select("*")
      .eq("room_code", code)
      .order("position");
    setQueue((data ?? []).map(rowToItem));
  }, [code]);

  const refetchMembers = useCallback(async () => {
    const { data } = await getSupabase()
      .from("room_members")
      .select("user_id, provider, display_name")
      .eq("room_code", code);
    setMembers((data ?? []) as Member[]);
  }, [code]);

  // Entrada na sala + canal em tempo real
  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    setSpotifyReady(isSpotifyConnected());

    (async () => {
      const user = await getCurrentUser();
      if (!user) {
        return router.replace(`/login?next=${encodeURIComponent(`/r/${code}?p=${provider}`)}`);
      }
      const supabase = getSupabase();
      const { error: joinErr } = await supabase.rpc("join_room", {
        p_code: code,
        p_provider: provider,
        p_display_name: displayNameOf(user),
      });
      if (joinErr) {
        return setError(joinErr.message.includes("room not found") ? "Sala nao encontrada." : joinErr.message);
      }
      const { data: room } = await supabase
        .from("rooms")
        .select("host_id, allow_guest_queue, state")
        .eq("code", code)
        .single();
      if (cancelled || !room) return;
      setUserId(user.id);
      const host = room.host_id === user.id;
      setIsHost(host);
      setAllowGuests(room.allow_guest_queue);
      await Promise.all([refetchMembers(), refetchQueue()]);

      const saved = room.state as Partial<PlaybackState> | null;
      if (saved && "queueItemId" in saved) {
        // estado salvo nao tem referencia de relogio confiavel: so exibe, espera o heartbeat
        const s = saved as PlaybackState;
        playbackRef.current = s;
        setPlayback(s);
      }

      channel = supabase.channel(`room:${code}`, {
        config: { private: true, presence: { key: user.id }, broadcast: { self: false } },
      });
      channel
        .on("broadcast", { event: "state" }, ({ payload }) => receiveState(payload as PlaybackState, true))
        .on("broadcast", { event: "queue" }, () => void refetchQueue())
        .on("broadcast", { event: "members" }, () => void refetchMembers())
        .on("presence", { event: "sync" }, () => {
          setOnline(new Set(Object.keys(channel!.presenceState())));
        })
        .on("presence", { event: "join" }, () => {
          void refetchMembers();
          if (isHostRef.current && playbackRef.current.queueItemId) {
            void channel!.send({ type: "broadcast", event: "state", payload: playbackRef.current });
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel!.track({ at: Date.now() });
            await channel!.send({ type: "broadcast", event: "members", payload: {} });
          }
        });
      channelRef.current = channel;

      heartbeat = setInterval(() => {
        if (isHostRef.current && playbackRef.current.queueItemId) {
          void channel!.send({ type: "broadcast", event: "state", payload: playbackRef.current });
        }
      }, 5000);
    })();

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      if (channel) void getSupabase().removeChannel(channel);
      channelRef.current = null;
    };
  }, [code, provider, router, receiveState, refetchQueue, refetchMembers]);

  // Relogio de tela + avanco automatico (host)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const current = queue.find((q) => q.id === playback.queueItemId) ?? null;
  const clockOffset = Number.isFinite(offsetRef.current) ? offsetRef.current : 0;
  const position = current ? expectedPositionMs(playback, now, clockOffset) : 0;

  const goNext = useCallback(
    (fromId: string | null) => {
      const list = queueRef.current;
      const idx = fromId ? list.findIndex((q) => q.id === fromId) : -1;
      const next = list[idx + 1];
      void publish(
        next
          ? { queueItemId: next.id, isPlaying: true, positionMs: 0, serverTs: Date.now() }
          : { queueItemId: null, isPlaying: false, positionMs: 0, serverTs: Date.now() },
      );
    },
    [publish],
  );

  useEffect(() => {
    if (isHost && current && playback.isPlaying && position >= current.durationMs) goNext(current.id);
  }, [isHost, current, playback.isPlaying, position, goNext]);

  function togglePause() {
    if (!current) return;
    const at = Date.now();
    if (playback.isPlaying) {
      void publish({ ...playback, isPlaying: false, positionMs: position, serverTs: at });
    } else {
      void publish({ ...playback, isPlaying: true, serverTs: at });
    }
  }

  async function search() {
    if (!query.trim()) return;
    setError("");
    const useSpotify = provider === "spotify" && spotifyReady;
    setResults(useSpotify ? await spotifyApi.search(query) : await deezerApi.search(query));
  }

  async function addToQueue(track: Track) {
    setError("");
    const resolved = await resolveTrack(track, { deezer: deezerApi, spotify: spotifyReady ? spotifyApi : undefined });
    if (!resolved.isrc) return setError("Nao foi possivel identificar essa faixa (sem ISRC).");
    const position = (queueRef.current.at(-1)?.position ?? 0) + 1;
    const { error: insErr } = await getSupabase().from("queue_items").insert({
      room_code: code,
      position,
      isrc: resolved.isrc,
      spotify_id: resolved.spotifyId ?? null,
      deezer_id: resolved.deezerId ?? null,
      title: resolved.title,
      artist: resolved.artist,
      duration_ms: resolved.durationMs,
      added_by: userId,
    });
    if (insErr) return setError(insErr.message);
    setResults([]);
    setQuery("");
    await refetchQueue();
    await channelRef.current?.send({ type: "broadcast", event: "queue", payload: {} });
  }

  async function toggleGuests() {
    const next = !allowGuests;
    setAllowGuests(next);
    await getSupabase().from("rooms").update({ allow_guest_queue: next }).eq("code", code);
  }

  const canAdd = isHost || allowGuests;
  const needsSpotify = provider === "spotify" && !spotifyReady;
  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/r/${code}`;

  if (error && members.length === 0) return <p role="alert">{error}</p>;

  return (
    <>
      <p>Sala {isHost ? "(voce e o host)" : ""}</p>
      <h1>{code}</h1>
      <div className="row">
        <button className="small" onClick={() => navigator.clipboard?.writeText(shareUrl)}>
          Copiar link
        </button>
        {isHost && (
          <label>
            <input type="checkbox" checked={allowGuests} onChange={toggleGuests} /> todos podem adicionar
          </label>
        )}
      </div>

      <ul className="members">
        {members.map((m) => (
          <li key={m.user_id}>
            {online.has(m.user_id) ? "●" : "○"} {m.display_name} - {m.provider}
          </li>
        ))}
      </ul>

      {needsSpotify && (
        <div className="card">
          {spotifyConfigured() ? (
            <>
              <p>Conecte o Spotify (Premium) para tocar e buscar musicas.</p>
              <button onClick={() => startSpotifyLogin(`/r/${code}?p=${provider}`)}>Conectar Spotify</button>
            </>
          ) : (
            <p role="alert">Spotify nao configurado (falta NEXT_PUBLIC_SPOTIFY_CLIENT_ID).</p>
          )}
        </div>
      )}
      {notice && <p role="alert">{notice}</p>}

      <section className="card">
        <h2>Tocando agora</h2>
        {current ? (
          <>
            <p>
              <strong>{current.title}</strong> - {current.artist}
            </p>
            <p>
              {fmt(position)} / {fmt(current.durationMs)} {playback.isPlaying ? "" : "(pausado)"}
            </p>
            {provider === "deezer" && (
              <p>
                {current.deezerId ? (
                  <>
                    Abra no Deezer e aperte play em <strong>{fmt(position)}</strong>:{" "}
                    <a className="btn small" href={`https://www.deezer.com/track/${current.deezerId}`} target="_blank" rel="noreferrer">
                      Abrir no Deezer
                    </a>
                  </>
                ) : (
                  "Esta faixa nao existe no Deezer."
                )}
              </p>
            )}
          </>
        ) : (
          <p>Nada tocando.</p>
        )}
        {isHost && (
          <div className="row">
            <button onClick={togglePause} disabled={!current}>
              {playback.isPlaying ? "Pausar" : "Tocar"}
            </button>
            <button onClick={() => goNext(current?.id ?? null)} disabled={queue.length === 0}>
              Proxima
            </button>
          </div>
        )}
      </section>

      <section>
        <h2>Fila</h2>
        {queue.length === 0 && <p>Fila vazia.</p>}
        <ul className="queue">
          {queue.map((q) => (
            <li key={q.id} className={q.id === playback.queueItemId ? "active" : ""}>
              <span>
                {q.title} - {q.artist}
                {provider === "spotify" && !q.spotifyId && !q.isrc ? " (indisponivel)" : ""}
                {provider === "deezer" && !q.deezerId ? " (indisponivel)" : ""}
              </span>
              {isHost && (
                <button
                  className="small"
                  onClick={() =>
                    publish({ queueItemId: q.id, isPlaying: true, positionMs: 0, serverTs: Date.now() })
                  }
                >
                  Tocar
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {canAdd && !needsSpotify && (
        <section>
          <h2>Adicionar musica</h2>
          <div className="row">
            <input
              className="field"
              placeholder="buscar musica ou artista"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void search()}
            />
            <button onClick={() => void search()}>Buscar</button>
          </div>
          <ul className="queue">
            {results.map((t, i) => (
              <li key={`${t.spotifyId ?? t.deezerId}-${i}`}>
                <span>
                  {t.title} - {t.artist} ({fmt(t.durationMs)})
                </span>
                <button className="small" onClick={() => void addToQueue(t)}>
                  Adicionar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
