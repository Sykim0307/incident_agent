"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function UserMenu() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (user === undefined) {
    return <div className="w-24" />;
  }

  if (!user) {
    return (
      <button
        onClick={signInWithGoogle}
        className="rounded border border-rule bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-2 whitespace-nowrap"
      >
        Google로 로그인
      </button>
    );
  }

  const label = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "사용자";
  const avatar = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="flex items-center gap-2">
      {avatar && (
        // eslint-disable-next-line @next/next/no-img-element -- external Google avatar URL, not worth next/image config for a small header icon
        <img src={avatar} alt="" className="w-6 h-6 rounded-full" />
      )}
      <span className="text-xs text-ink-soft whitespace-nowrap max-w-[10rem] truncate">
        {label}
      </span>
      <button
        onClick={signOut}
        className="text-xs text-ink-faint underline hover:text-ink whitespace-nowrap"
      >
        로그아웃
      </button>
    </div>
  );
}
