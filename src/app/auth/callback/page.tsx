"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * OAuth redirect target. supabase-js's browser client auto-detects the
 * ?code=... in this page's URL on init (detectSessionInUrl defaults to
 * true) and exchanges it for a session; we just wait for that to land
 * (or time out) and send the user back to the dashboard.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        router.replace("/");
      }
    });
    const fallback = setTimeout(() => router.replace("/"), 3000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, [supabase, router]);

  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center text-sm text-ink-faint">
      로그인 처리 중…
    </div>
  );
}
