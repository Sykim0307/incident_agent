import { NextRequest, NextResponse } from "next/server";
import { createAnonSupabaseClient } from "@/lib/supabase/server";
import { analyzeRawLog } from "@/lib/agent/analyze";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const rawLog = typeof body?.rawLog === "string" ? body.rawLog.trim() : "";

  if (!rawLog) {
    return NextResponse.json({ error: "rawLog is required" }, { status: 400 });
  }

  const supabase = createAnonSupabaseClient();
  const result = await analyzeRawLog(supabase, rawLog, body?.sourceSystem ?? "");
  return NextResponse.json(result);
}
