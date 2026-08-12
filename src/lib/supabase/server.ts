import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Server-only client using the service role key - bypasses RLS.
 * Used by API routes that write data (log generation, checklist updates, recovery actions).
 * Never import this from a client component.
 */
export function createServiceSupabaseClient() {
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local / Vercel project env vars."
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

/** Server-side read client using the anon key, for server components that only read data. */
export function createAnonSupabaseClient() {
  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}
