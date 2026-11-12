import { describe, expect, it } from "vitest";
import { decideSyncAction, estimateClockOffset, expectedPositionMs } from "./sync";
import type { PlaybackState } from "./types";

const playing: PlaybackState = {
  queueItemId: "a",
  isPlaying: true,
  positionMs: 10_000,
  serverTs: 1_000_000,
};

describe("clock offset", () => {
  it("estima offset pelo ponto médio do ping", () => {
    // local 100..300 (meio 200), servidor leu 1200 → offset 1000
    expect(estimateClockOffset(100, 300, 1200)).toBe(1000);
  });
});

describe("expectedPositionMs", () => {
  it("avança com o tempo quando tocando", () => {
    expect(expectedPositionMs(playing, 500, 1_000_000 - 500 + 2000)).toBe(12_000);
  });
  it("não avança quando pausado", () => {
    expect(expectedPositionMs({ ...playing, isPlaying: false }, 9999, 0)).toBe(10_000);
  });
});

describe("decideSyncAction", () => {
  const base = {
    state: playing,
    localNow: 1_000_000,
    clockOffset: 0,
    currentQueueItemId: "a",
    currentIsPlaying: true,
    currentPositionMs: 10_000,
  };
  it("não faz nada quando alinhado", () => {
    expect(decideSyncAction(base)).toEqual({ type: "none" });
  });
  it("faz seek quando o drift passa do limite", () => {
    expect(decideSyncAction({ ...base, currentPositionMs: 7_000 })).toEqual({
      type: "seek",
      positionMs: 10_000,
    });
  });
  it("toca a nova faixa quando a faixa difere", () => {
    expect(decideSyncAction({ ...base, currentQueueItemId: "b" })).toEqual({
      type: "play",
      positionMs: 10_000,
    });
  });
  it("pausa quando o host pausou", () => {
    expect(
      decideSyncAction({ ...base, state: { ...playing, isPlaying: false } }),
    ).toEqual({ type: "pause" });
  });
  it("retoma quando o host voltou a tocar", () => {
    expect(decideSyncAction({ ...base, currentIsPlaying: false })).toEqual({
      type: "play",
      positionMs: 10_000,
    });
  });
});
