export type Provider = "spotify" | "deezer";

export interface Track {
  isrc: string;
  title: string;
  artist: string;
  durationMs: number;
  spotifyId?: string;
  deezerId?: string;
}

/** Estado de reprodução publicado pelo host. */
export interface PlaybackState {
  queueItemId: string | null;
  isPlaying: boolean;
  /** Posição da faixa (ms) no instante `serverTs`. */
  positionMs: number;
  /** Timestamp (ms, relógio do servidor) em que positionMs foi medido. */
  serverTs: number;
}

/** Interface que cada plataforma implementa. */
export interface PlayerAdapter {
  readonly provider: Provider;
  play(track: Track, positionMs: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  getPositionMs(): Promise<number | null>;
}
