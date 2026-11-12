"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const auth = getSupabase().auth;
    if (mode === "signin") {
      const { error } = await auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else router.replace(next);
    } else {
      const { data, error } = await auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + next },
      });
      if (error) setMessage(error.message);
      else if (data.session) router.replace(next);
      else setMessage("Conta criada! Confirme o e-mail que enviamos e depois entre.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="stack">
      <input type="email" required autoComplete="email" placeholder="e-mail"
        value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
      <input type="password" required minLength={6}
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        placeholder="senha (mín. 6 caracteres)"
        value={password} onChange={(e) => setPassword(e.target.value)} className="field" />
      <button type="submit" disabled={busy}>
        {mode === "signin" ? "Entrar" : "Criar conta"}
      </button>
      <button type="button" className="link"
        onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>
        {mode === "signin" ? "Não tenho conta" : "Já tenho conta"}
      </button>
      {message && <p role="alert">{message}</p>}
    </form>
  );
}
