import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Cliente do navegador. Garante uma sessão anônima antes de usar. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
  }
  return client;
}

export async function ensureSession(): Promise<string> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.user) throw error ?? new Error("anonymous sign-in failed");
  return anon.user.id;
}
