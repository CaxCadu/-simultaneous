"use client";

import type { Provider } from "@simultaneous/core";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { displayNameOf, getCurrentUser, getSupabase } from "@/lib/supabase";

interface Member {
  user_id: string;
  provider: Provider;
  display_name: string;
}

export function Room({ code }: { code: string }) {
  const router = useRouter();
  const pParam = useSearchParams().get("p");
  const provider: Provider = pParam === "deezer" ? "deezer" : "spotify";
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await getCurrentUser();
      if (!user) {
        return router.replace(`/login?next=${encodeURIComponent(`/r/${code}?p=${provider}`)}`);
      }
      const supabase = getSupabase();
      const { error: joinErr } = await supabase.rpc("join_room", {
        p_code: code,
        p_provider: provider,
        p_display_name: displayNameOf(user),
      });
      if (joinErr) {
        return setError(joinErr.message === "room not found" ? "Sala não encontrada." : joinErr.message);
      }
      const { data } = await supabase
        .from("room_members")
        .select("user_id, provider, display_name")
        .eq("room_code", code);
      if (!cancelled) setMembers((data ?? []) as Member[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [code, provider, router]);

  return (
    <>
      <p>Sala</p>
      <h1>{code}</h1>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <ul className="members">
          {members.map((m) => (
            <li key={m.user_id}>
              {m.display_name} · {m.provider}
            </li>
          ))}
        </ul>
      )}
      <p>Fila, player e sincronização entram nas próximas etapas.</p>
    </>
  );
}
