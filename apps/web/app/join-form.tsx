"use client";

import { normalizeRoomCode, type Provider } from "@simultaneous/core";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { displayNameOf, getCurrentUser, getSupabase } from "@/lib/supabase";

export function JoinForm() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [provider, setProvider] = useState<Provider>("spotify");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  if (user === undefined) return null;
  if (!user) {
    return (
      <div className="row">
        <Link className="btn" href="/login">Entrar / criar conta</Link>
      </div>
    );
  }

  async function create() {
    setError("");
    const { data, error } = await getSupabase().rpc("create_room", {
      p_provider: provider,
      p_display_name: displayNameOf(user!),
    });
    if (error) return setError(error.message);
    router.push(`/r/${data as string}?p=${provider}`);
  }

  function join() {
    const code = normalizeRoomCode(value);
    if (!code) return setError("Código inválido (6 caracteres).");
    router.push(`/r/${code}?p=${provider}`);
  }

  async function signOut() {
    await getSupabase().auth.signOut();
    setUser(null);
  }

  return (
    <div>
      <p>Logado como {user.email} · <button className="link" onClick={signOut}>sair</button></p>
      <div className="row">
        <label>
          Eu uso:{" "}
          <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
            <option value="spotify">Spotify</option>
            <option value="deezer">Deezer</option>
          </select>
        </label>
      </div>
      <div className="row">
        <button onClick={create}>Criar sala</button>
      </div>
      <div className="row">
        <input value={value} placeholder="CÓDIGO" maxLength={7} aria-label="Código da sala"
          onChange={(e) => { setValue(e.target.value); setError(""); }} />
        <button onClick={join}>Entrar</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
