import { describe, expect, it } from "vitest";
import type { Track } from "@simultaneous/core";
import { createDeezerClient } from "./deezer";
import { createSpotifyClient } from "./spotify";
import { pickBestMatch, resolveTrack } from "./match";

const json = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

const deezerFetch = (url: string) => {
  if (url.includes("/track/isrc:USUM71703861"))
    return json({ id: 123, title: "Sicko Mode", duration: 312, isrc: "USUM71703861", artist: { name: "Travis Scott" } });
  if (url.includes("/track/isrc:")) return json({ error: { type: "DataException" } });
  if (url.includes("/track/555"))
    return json({ id: 555, title: "Blinding Lights", duration: 200, isrc: "USUG11904206", artist: { name: "The Weeknd" } });
  if (url.includes("/search"))
    return json({ data: [{ id: 9, title: "Blinding Lights (Remastered)", duration: 201, artist: { name: "The Weeknd" } }] });
  return json({}, false);
};

const spotifyFetch = (url: string) => {
  if (url.includes("isrc%3AUSUG11904206"))
    return json({ tracks: { items: [{ id: "sp1", name: "Blinding Lights", duration_ms: 200040, artists: [{ name: "The Weeknd" }], external_ids: { isrc: "USUG11904206" } }] } });
  return json({ tracks: { items: [] } });
};

const deezer = createDeezerClient("https://api.deezer.com", deezerFetch);
const spotify = createSpotifyClient(async () => "tok", spotifyFetch);

describe("resolveTrack", () => {
  it("Spotify -> Deezer por ISRC", async () => {
    const t: Track = { isrc: "USUM71703861", title: "Sicko Mode", artist: "Travis Scott", durationMs: 312000, spotifyId: "s1" };
    expect((await resolveTrack(t, { deezer, spotify })).deezerId).toBe("123");
  });

  it("Deezer -> Spotify: completa o ISRC via /track/{id}", async () => {
    const t: Track = { isrc: "", title: "Blinding Lights", artist: "The Weeknd", durationMs: 200000, deezerId: "555" };
    const out = await resolveTrack(t, { deezer, spotify });
    expect(out.isrc).toBe("USUG11904206");
    expect(out.spotifyId).toBe("sp1");
  });

  it("fallback por titulo/artista/duracao quando o ISRC nao existe", async () => {
    const t: Track = { isrc: "XX0000000000", title: "Blinding Lights", artist: "The Weeknd", durationMs: 200000, spotifyId: "s2" };
    expect((await resolveTrack(t, { deezer })).deezerId).toBe("9");
  });

  it("deixa o id ausente quando nao ha equivalente", async () => {
    const t: Track = { isrc: "XX0000000000", title: "Outra Coisa", artist: "Ninguem", durationMs: 100000, spotifyId: "s3" };
    expect((await resolveTrack(t, { deezer })).deezerId).toBeUndefined();
  });
});

describe("pickBestMatch", () => {
  const target: Track = { isrc: "", title: "Song (Live)", artist: "Band", durationMs: 180000 };
  it("rejeita duracao muito diferente", () => {
    expect(pickBestMatch(target, [{ isrc: "", title: "Song", artist: "Band", durationMs: 240000 }])).toBeNull();
  });
  it("ignora sufixos entre parenteses", () => {
    const c: Track = { isrc: "", title: "Song", artist: "Band", durationMs: 181000, deezerId: "1" };
    expect(pickBestMatch(target, [c])).toBe(c);
  });
});
