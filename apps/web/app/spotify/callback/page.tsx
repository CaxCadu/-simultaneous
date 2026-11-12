"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { finishSpotifyLogin } from "@/lib/spotify-auth";

export default function SpotifyCallback() {
  const router = useRouter();
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return setError(params.get("error") ?? "Login do Spotify cancelado.");
    finishSpotifyLogin(code).then((returnTo) => {
      if (returnTo) router.replace(returnTo);
      else setError("Nao foi possivel conectar ao Spotify.");
    });
  }, [router]);

  return (
    <main>
      <h1>Spotify</h1>
      <p role={error ? "alert" : undefined}>{error || "Conectando..."}</p>
    </main>
  );
}
