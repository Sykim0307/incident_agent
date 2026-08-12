import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Browser client - safe to use in client components (anon key, RLS-restricted to reads). */
export function createBrowserSupabaseClient() {
  return createClient(url, anonKey);
}
