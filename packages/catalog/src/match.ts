import type { Track } from "@simultaneous/core";
import type { DeezerClient } from "./deezer";
import type { SpotifyClient } from "./spotify";

const DURATION_TOLERANCE_MS = 3000;

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)|\[.*?\]/g, "") // "(Remastered)", "[Live]"...
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Fallback sem ISRC: mesmo titulo, artista compativel e duracao proxima. */
export function pickBestMatch(target: Track, candidates: Track[]): Track | null {
  const title = norm(target.title);
  const artist = norm(target.artist);
  const scored = candidates
    .filter((c) => norm(c.title) === title)
    .filter((c) => {
      const ca = norm(c.artist);
      return ca.includes(artist) || artist.includes(ca);
    })
    .filter((c) => Math.abs(c.durationMs - target.durationMs) <= DURATION_TOLERANCE_MS)
    .sort(
      (a, b) =>
        Math.abs(a.durationMs - target.durationMs) - Math.abs(b.durationMs - target.durationMs),
    );
  return scored[0] ?? null;
}

export interface Resolvers {
  spotify?: SpotifyClient;
  deezer: DeezerClient;
}

/**
 * Completa `spotifyId`/`deezerId`/`isrc` de uma faixa. Primeiro por ISRC,
 * depois por titulo+artista+duracao. Ids nao achados ficam ausentes
 * (a faixa e marcada "indisponivel" naquela plataforma).
 */
export async function resolveTrack(track: Track, r: Resolvers): Promise<Track> {
  let out: Track = { ...track };

  // Deezer: a busca nao traz ISRC, entao completa via /track/{id}.
  if (!out.isrc && out.deezerId) {
    const full = await r.deezer.getTrack(out.deezerId);
    if (full?.isrc) out.isrc = full.isrc;
  }

  if (!out.deezerId) {
    const hit =
      (out.isrc ? await r.deezer.getByIsrc(out.isrc) : null) ??
      pickBestMatch(out, await r.deezer.search(`${out.artist} ${out.title}`));
    if (hit?.deezerId) out = { ...out, deezerId: hit.deezerId, isrc: out.isrc || hit.isrc };
  }

  if (!out.spotifyId && r.spotify) {
    const hit =
      (out.isrc ? await r.spotify.getByIsrc(out.isrc) : null) ??
      pickBestMatch(out, await r.spotify.search(`${out.artist} ${out.title}`));
    if (hit?.spotifyId) out = { ...out, spotifyId: hit.spotifyId, isrc: out.isrc || hit.isrc };
  }

  return out;
}
