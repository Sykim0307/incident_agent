import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { notifyOnCall } from "@/lib/agent/notify";

export const dynamic = "force-dynamic";

/**
 * Manual "당직자에게 알림 재전송" button. The automatic send already happens
 * inside runMonitoringTick(); this just lets an operator trigger another
 * (still fully simulated) round for the same incident.
 */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/incidents/[id]/notify">
) {
  const { id } = await ctx.params;
  const supabase = createServiceSupabaseClient();

  const { data: event } = await supabase
    .from("incident_events")
    .select("*, incidents_kb:matched_incident_id(title)")
    .eq("id", id)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: "incident not found" }, { status: 404 });
  }

  const result = await notifyOnCall(supabase, {
    incidentEventId: id,
    sourceSystem: event.source_system,
    severity: event.severity,
    summary: event.incidents_kb?.title ?? event.llm_summary ?? "장애 상세는 대시보드에서 확인하세요.",
  });

  return NextResponse.json(result);
}
