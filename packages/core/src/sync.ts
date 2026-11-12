import type { PlaybackState } from "./types";

/** Diferença máxima tolerada antes de corrigir com seek. */
export const DRIFT_THRESHOLD_MS = 1500;

/**
 * Estima o offset entre o relógio local e o do servidor a partir de um
 * ping: `serverNow` foi lido entre `sentAt` e `receivedAt` (relógio local).
 * Retorna `serverTime - localTime`.
 */
export function estimateClockOffset(
  sentAt: number,
  receivedAt: number,
  serverNow: number,
): number {
  const midpoint = sentAt + (receivedAt - sentAt) / 2;
  return serverNow - midpoint;
}

/** Posição esperada agora (ms) dado o estado do host. */
export function expectedPositionMs(
  state: PlaybackState,
  localNow: number,
  clockOffset: number,
): number {
  if (!state.isPlaying) return state.positionMs;
  const serverNow = localNow + clockOffset;
  return Math.max(0, state.positionMs + (serverNow - state.serverTs));
}

export type SyncAction =
  | { type: "none" }
  | { type: "play"; positionMs: number }
  | { type: "pause" }
  | { type: "seek"; positionMs: number };

/**
 * Decide o que um cliente com player automático deve fazer para alinhar
 * com o host.
 */
export function decideSyncAction(args: {
  state: PlaybackState;
  localNow: number;
  clockOffset: number;
  currentQueueItemId: string | null;
  currentIsPlaying: boolean;
  currentPositionMs: number | null;
  thresholdMs?: number;
}): SyncAction {
  const { state, localNow, clockOffset } = args;
  const threshold = args.thresholdMs ?? DRIFT_THRESHOLD_MS;

  if (state.queueItemId === null) {
    return args.currentIsPlaying ? { type: "pause" } : { type: "none" };
  }
  const expected = expectedPositionMs(state, localNow, clockOffset);

  if (args.currentQueueItemId !== state.queueItemId) {
    return state.isPlaying
      ? { type: "play", positionMs: expected }
      : { type: "none" };
  }
  if (!state.isPlaying) {
    return args.currentIsPlaying ? { type: "pause" } : { type: "none" };
  }
  if (!args.currentIsPlaying) return { type: "play", positionMs: expected };
  if (
    args.currentPositionMs !== null &&
    Math.abs(args.currentPositionMs - expected) > threshold
  ) {
    return { type: "seek", positionMs: expected };
  }
  return { type: "none" };
}
