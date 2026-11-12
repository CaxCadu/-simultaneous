"use client";

import { useState } from "react";
import { getSpotifyToken, isSpotifyConnected, startSpotifyLogin } from "@/lib/spotify-auth";

const TEST_TRACK = "spotify:track:4cOdK2wGLETKBW3PvgPWqT";

async function step(label: string, url: string, init: RequestInit = {}) {
  const token = await getSpotifyToken();
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const text = await res.text();
  return `## ${label}\n${init.method ?? "GET"} ${url.replace("https://api.spotify.com/v1", "")}\n=> ${res.status}\n${text.slice(0, 600)}\n`;
}

export default function DebugPage() {
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    let log = "";
    const add = async (fn: () => Promise<string>) => {
      try {
        log += (await fn()) + "\n";
      } catch (e) {
        log += `ERRO: ${e instanceof Error ? e.message : String(e)}\n\n`;
      }
      setOut(log);
    };
    const api = "https://api.spotify.com/v1";
    await add(() => step("Conta (precisa ser premium)", `${api}/me`));
    await add(() => step("Dispositivos", `${api}/me/player/devices`));
    await add(() => step("Estado atual", `${api}/me/player`));
    await add(() =>
      step("Tocar faixa de teste", `${api}/me/player/play`, {
        method: "PUT",
        body: JSON.stringify({ uris: [TEST_TRACK] }),
      }),
    );
    await new Promise((r) => setTimeout(r, 1500));
    await add(() => step("Estado depois de tocar", `${api}/me/player`));
    setBusy(false);
  }

  return (
    <main>
      <h1>Diagnostico Spotify</h1>
      {!isSpotifyConnected() ? (
        <button onClick={() => startSpotifyLogin("/debug")}>Conectar Spotify</button>
      ) : (
        <button onClick={run} disabled={busy}>
          {busy ? "Rodando..." : "Rodar diagnostico"}
        </button>
      )}
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: 12, color: "#b4b4c0" }}>{out}</pre>
    </main>
  );
}
