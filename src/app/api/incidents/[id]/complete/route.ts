import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Explicit "장애 조치 완료" action - lets an operator close an incident
 * directly (e.g. when there's nothing to recover, or before recovery even
 * runs) rather than only ever resolving as a side effect of runRecovery().
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/incidents/[id]/complete">
) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null;

  const supabase = createServiceSupabaseClient();

  const { data: event, error } = await supabase
    .from("incident_events")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolution_method: "manual",
      resolution_note: note,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ event });
}
