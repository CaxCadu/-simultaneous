"use client";

import { useState } from "react";
import { getSpotifyToken, isSpotifyConnected, startSpotifyLogin } from "@/lib/spotify-auth";

const API = "https://api.spotify.com/v1";
const TEST_TRACK = "spotify:track:4cOdK2wGLETKBW3PvgPWqT";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface PlayerState {
  is_playing?: boolean;
  progress_ms?: number;
  device?: { id: string; name: string; type: string; is_active: boolean };
  item?: { uri: string; name: string; is_playable?: boolean } | null;
  actions?: { disallows?: Record<string, boolean> };
}

async function api(path: string, init: RequestInit = {}) {
  const token = await getSpotifyToken();
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
}

async function state(): Promise<PlayerState | null> {
  const res = await api("/me/player");
  return res.status === 200 ? ((await res.json()) as PlayerState) : null;
}

function brief(s: PlayerState | null) {
  if (!s) return "(sem estado)";
  return [
    `dispositivo: ${s.device?.name} (${s.device?.type}) ativo=${s.device?.is_active}`,
    `tocando=${s.is_playing} progresso=${s.progress_ms}ms`,
    `faixa: ${s.item ? `${s.item.name} [${s.item.uri}]` : "NENHUMA"}`,
    `bloqueios: ${JSON.stringify(s.actions?.disallows ?? {})}`,
  ].join("\n");
}

export default function DebugPage() {
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    let log = "";
    const say = (t: string) => {
      log += t + "\n";
      setOut(log);
    };

    async function attempt(label: string, uri: string, deviceId?: string) {
      say(`\n## ${label}`);
      const q = deviceId ? `?device_id=${deviceId}` : "";
      const res = await api(`/me/player/play${q}`, {
        method: "PUT",
        body: JSON.stringify({ uris: [uri], position_ms: 0 }),
      });
      say(`PUT /play${q ? " (com device_id)" : ""} => ${res.status} ${res.status === 204 ? "" : await res.text()}`);
      for (const wait of [1500, 3000, 4000]) {
        await sleep(wait);
        say(`+${wait}ms\n${brief(await state())}`);
      }
    }

    try {
      const me = await (await api("/me")).json();
      say(`conta: ${me.display_name} | product=${me.product ?? "(Spotify nao informa)"}`);
      const devices = await (await api("/me/player/devices")).json();
      say(`dispositivos: ${JSON.stringify(devices.devices?.map((d: { name: string; type: string; is_active: boolean }) => `${d.name} (${d.type}${d.is_active ? ", ativo" : ""})`))}`);
      const before = await state();
      say(`\n## Estado inicial\n${brief(before)}`);
      const deviceId = before?.device?.id;
      if (before?.item?.uri) await attempt("Teste A: repetir a faixa que ja esta tocando", before.item.uri, deviceId);
      await attempt("Teste B: faixa de teste (Rick Astley)", TEST_TRACK, deviceId);
    } catch (e) {
      say(`ERRO: ${e instanceof Error ? e.message : String(e)}`);
    }
    setBusy(false);
  }

  return (
    <main>
      <h1>Diagnostico Spotify</h1>
      <p>Deixe uma musica TOCANDO no Spotify antes de rodar.</p>
      {!isSpotifyConnected() ? (
        <button onClick={() => startSpotifyLogin("/debug")}>Conectar Spotify</button>
      ) : (
        <button onClick={run} disabled={busy}>
          {busy ? "Rodando (~20s)..." : "Rodar diagnostico"}
        </button>
      )}
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: 12, color: "#b4b4c0" }}>{out}</pre>
    </main>
  );
}
