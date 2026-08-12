import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { runMonitoringTick } from "@/lib/agent/tick";

export const dynamic = "force-dynamic";

/**
 * Unprotected heartbeat endpoint for the live demo ("지금 로그 생성" button).
 * Does the same work as the cron route, but is safe to call on demand so the
 * presentation never has to wait on cron timing.
 */
export async function POST() {
  const supabase = createServiceSupabaseClient();
  try {
    const result = await runMonitoringTick(supabase);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}
