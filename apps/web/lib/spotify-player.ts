import type { PlayerAdapter, Track } from "@simultaneous/core";
import { getSpotifyToken } from "./spotify-auth";

const API = "https://api.spotify.com/v1/me/player";

async function call(path: string, method: string, body?: unknown) {
  return fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await getSpotifyToken()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export class SpotifyConnectAdapter implements PlayerAdapter {
  readonly provider = "spotify" as const;

  /** Falha com mensagem clara se nao houver dispositivo ativo (abrir o app do Spotify). */
  private async check(res: Response) {
    if (res.status === 404) throw new Error("Abra o app do Spotify e toque qualquer musica uma vez.");
    if (res.status === 403) throw new Error("O controle do Spotify exige Premium.");
    if (!res.ok && res.status !== 204) throw new Error(`Spotify respondeu ${res.status}`);
  }

  async play(track: Track, positionMs: number) {
    if (!track.spotifyId) return;
    await this.check(
      await call("/play", "PUT", { uris: [`spotify:track:${track.spotifyId}`], position_ms: Math.round(positionMs) }),
    );
  }
  async pause() {
    await this.check(await call("/pause", "PUT"));
  }
  async resume() {
    await this.check(await call("/play", "PUT"));
  }
  async seek(positionMs: number) {
    await this.check(await call(`/seek?position_ms=${Math.round(positionMs)}`, "PUT"));
  }
  async getPositionMs(): Promise<number | null> {
    const res = await call("", "GET");
    if (res.status !== 200) return null;
    const json = (await res.json()) as { progress_ms: number | null };
    return json.progress_ms;
  }
}
