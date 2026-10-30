import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";

/**
 * Privileged client (bypasses RLS). Used ONLY for Supabase Auth admin
 * operations — creating, banning and unbanning login accounts — after the
 * caller has been verified as a Super Admin. Never import from client code.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SECRET_KEY is not set. Add it to the server environment (never NEXT_PUBLIC_).");
  }
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
