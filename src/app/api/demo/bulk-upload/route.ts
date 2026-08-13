import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { ingestLog } from "@/lib/agent/tick";
import type { LogLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_LINES = 50;

function inferLevel(line: string): LogLevel {
  if (/error/i.test(line)) return "ERROR";
  if (/warn/i.test(line)) return "WARN";
  return "INFO";
}

function inferSourceSystem(line: string): string {
  const match = line.match(/\[([^\]]+)\]/);
  return match ? match[1] : "업로드된 로그";
}

/**
 * Bulk-ingests user-supplied sample log lines (e.g. a pasted .log/.txt file)
 * through the same detect -> match -> checklist -> notify pipeline as the
 * random-scenario tick, so uploaded data behaves like real monitoring input
 * instead of just being inserted inert.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const rawLines = Array.isArray(body?.lines) ? body.lines : [];
  const lines = rawLines
    .filter((l: unknown) => typeof l === "string" && l.trim().length > 0)
    .slice(0, MAX_LINES);

  if (lines.length === 0) {
    return NextResponse.json({ error: "no valid lines provided" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  let incidentsDetected = 0;
  for (const line of lines as string[]) {
    const trimmed = line.trim();
    const level = inferLevel(trimmed);
    const sourceSystem = inferSourceSystem(trimmed);
    const result = await ingestLog(supabase, {
      source_system: sourceSystem,
      level,
      message: trimmed.slice(0, 120),
      raw_log: trimmed,
    });
    if (result.incidentEventId) incidentsDetected += 1;
  }

  return NextResponse.json({ inserted: lines.length, incidentsDetected });
}
