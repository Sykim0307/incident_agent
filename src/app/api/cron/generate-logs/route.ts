import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { runMonitoringTick } from "@/lib/agent/tick";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron target - simulates the "24시간 구동" monitoring agent by emitting
 * one mock log heartbeat per invocation. Schedule lives in vercel.json.
 * Protected by CRON_SECRET so the write-capable endpoint isn't publicly open.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

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
