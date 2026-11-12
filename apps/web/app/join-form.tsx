"use client";

import { generateRoomCode, normalizeRoomCode } from "@simultaneous/core";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function join() {
    const code = normalizeRoomCode(value);
    if (!code) return setError("Código inválido (6 caracteres).");
    router.push(`/r/${code}`);
  }

  return (
    <div>
      <div className="row">
        <button onClick={() => router.push(`/r/${generateRoomCode()}`)}>Criar sala</button>
      </div>
      <div className="row">
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(""); }}
          placeholder="CÓDIGO"
          maxLength={7}
          aria-label="Código da sala"
        />
        <button onClick={join}>Entrar</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
