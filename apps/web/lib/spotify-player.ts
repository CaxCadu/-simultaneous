import type { PlayerAdapter, Track } from "@simultaneous/core";
import { getSpotifyToken } from "./spotify-auth";

const API = "https://api.spotify.com/v1/me/player";

interface SpotifyDevice {
  id: string | null;
  name: string;
  type: string;
  is_active: boolean;
  is_restricted: boolean;
}

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

/** Transforma a resposta de erro do Spotify em mensagem legivel. */
async function explain(res: Response): Promise<string> {
  let detail = "";
  try {
    const json = (await res.json()) as { error?: { message?: string; reason?: string } };
    detail = [json.error?.reason, json.error?.message].filter(Boolean).join(" - ");
  } catch {
    /* corpo vazio */
  }
  if (res.status === 401) return "Sessao do Spotify invalida. Reconecte o Spotify.";
  if (res.status === 403) {
    return `Spotify recusou o comando (403). Precisa de Premium e de usuario autorizado no app do Spotify. ${detail}`.trim();
  }
  if (res.status === 429) return "Spotify limitou as requisicoes (429). Tente de novo em alguns segundos.";
  return `Spotify respondeu ${res.status}${detail ? `: ${detail}` : ""}`;
}

export class SpotifyConnectAdapter implements PlayerAdapter {
  readonly provider = "spotify" as const;

  /** Dispositivo escolhido quando nenhum esta ativo (celular com o app aberto). */
  private deviceId: string | null = null;

  private async pickDevice(): Promise<string> {
    const res = await call("/devices", "GET");
    if (!res.ok) throw new Error(await explain(res));
    const { devices } = (await res.json()) as { devices: SpotifyDevice[] };
    const usable = devices.filter((d) => d.id && !d.is_restricted);
    const device = usable.find((d) => d.is_active) ?? usable[0];
    if (!device?.id) {
      throw new Error(
        "Nenhum dispositivo Spotify encontrado. Abra o app do Spotify neste aparelho, toque uma musica por alguns segundos e volte.",
      );
    }
    this.deviceId = device.id;
    return device.id;
  }

  /** Executa um comando; se nao ha dispositivo ativo, ativa um e tenta de novo. */
  private async command(path: string, method: string, body?: unknown) {
    const withDevice = (id: string | null) =>
      id ? `${path}${path.includes("?") ? "&" : "?"}device_id=${encodeURIComponent(id)}` : path;

    let res = await call(withDevice(this.deviceId), method, body);
    if (res.status === 404) {
      const id = await this.pickDevice();
      // transfere a reproducao para o dispositivo (acorda o app) antes de repetir
      await call("", "PUT", { device_ids: [id], play: false });
      await new Promise((r) => setTimeout(r, 800));
      res = await call(withDevice(id), method, body);
    }
    if (!res.ok && res.status !== 204) throw new Error(await explain(res));
  }

  async play(track: Track, positionMs: number) {
    if (!track.spotifyId) return;
    await this.command("/play", "PUT", {
      uris: [`spotify:track:${track.spotifyId}`],
      position_ms: Math.max(0, Math.round(positionMs)),
    });
  }
  async pause() {
    await this.command("/pause", "PUT");
  }
  async resume() {
    await this.command("/play", "PUT");
  }
  async seek(positionMs: number) {
    await this.command(`/seek?position_ms=${Math.max(0, Math.round(positionMs))}`, "PUT");
  }
  async getPositionMs(): Promise<number | null> {
    const res = await call("", "GET");
    if (res.status !== 200) return null;
    const json = (await res.json()) as { progress_ms: number | null };
    return json.progress_ms;
  }
}
