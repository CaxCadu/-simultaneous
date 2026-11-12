import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Cliente com secret key — somente rotas de servidor. */
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );
}
