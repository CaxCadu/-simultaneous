import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Cliente do navegador (sessão persistida em localStorage). */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
  }
  return client;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user ?? null;
}

export function displayNameOf(user: User): string {
  return (user.email ?? "Convidado").split("@")[0]!.slice(0, 40);
}
