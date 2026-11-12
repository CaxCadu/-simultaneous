import type { Track } from "@simultaneous/core";
import type { FetchLike } from "./deezer";

interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  external_ids?: { isrc?: string };
}

function toTrack(t: SpotifyTrack): Track {
  return {
    isrc: t.external_ids?.isrc ?? "",
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    durationMs: t.duration_ms,
    spotifyId: t.id,
  };
}

/** Cliente minimo da Spotify Web API (token do proprio usuario). */
export function createSpotifyClient(
  getToken: () => Promise<string>,
  fetchFn: FetchLike = fetch,
) {
  async function search(q: string, limit: number): Promise<Track[]> {
    // Development Mode limita `limit` a 10.
    const url = `https://api.spotify.com/v1/search?type=track&limit=${Math.min(limit, 10)}&q=${encodeURIComponent(q)}`;
    const res = await fetchFn(url, { headers: { Authorization: `Bearer ${await getToken()}` } });
    if (!res.ok) return [];
    const json = (await res.json()) as { tracks?: { items: SpotifyTrack[] } };
    return json.tracks?.items.map(toTrack) ?? [];
  }

  return {
    search: (query: string, limit = 10) => search(query, limit),
    async getByIsrc(isrc: string): Promise<Track | null> {
      return (await search(`isrc:${isrc}`, 1))[0] ?? null;
    },
  };
}

export type SpotifyClient = ReturnType<typeof createSpotifyClient>;
