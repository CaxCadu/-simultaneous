import type { Track } from "@simultaneous/core";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

interface DeezerTrack {
  id: number;
  title: string;
  duration: number; // segundos
  isrc?: string;
  artist?: { name: string };
}

function toTrack(t: DeezerTrack): Track {
  return {
    isrc: t.isrc ?? "",
    title: t.title,
    artist: t.artist?.name ?? "",
    durationMs: t.duration * 1000,
    deezerId: String(t.id),
  };
}

/**
 * Cliente da API publica do Deezer (sem login). `baseUrl` aponta para o proxy
 * do servidor (o Deezer nao envia CORS) ou para https://api.deezer.com.
 */
export function createDeezerClient(baseUrl: string, fetchFn: FetchLike = fetch) {
  async function get<T>(path: string): Promise<T | null> {
    const res = await fetchFn(`${baseUrl}${path}`);
    if (!res.ok) return null;
    const json = (await res.json()) as T & { error?: unknown };
    return json.error ? null : json;
  }

  return {
    /** A busca do Deezer nao devolve ISRC; use `getTrack` para completar. */
    async search(query: string, limit = 10): Promise<Track[]> {
      const json = await get<{ data: DeezerTrack[] }>(
        `/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      );
      return json?.data.map(toTrack) ?? [];
    },
    async getTrack(id: string): Promise<Track | null> {
      const t = await get<DeezerTrack>(`/track/${encodeURIComponent(id)}`);
      return t ? toTrack(t) : null;
    },
    async getByIsrc(isrc: string): Promise<Track | null> {
      const t = await get<DeezerTrack>(`/track/isrc:${encodeURIComponent(isrc)}`);
      return t ? toTrack(t) : null;
    },
  };
}

export type DeezerClient = ReturnType<typeof createDeezerClient>;
