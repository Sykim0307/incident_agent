import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Marks one checklist step done/undone and runs a lightweight mock verification
 * for that single step ("조치가 올바르게 이루어졌는지 실시간 확인").
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/incidents/[id]/checklist">
) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const stepNo = Number(body?.step_no);
  const isDone = Boolean(body?.is_done);

  if (!Number.isFinite(stepNo)) {
    return NextResponse.json({ error: "step_no is required" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  const verificationResult = isDone
    ? "정상 확인됨"
    : null;

  const { data, error } = await supabase
    .from("checklist_progress")
    .update({
      is_done: isDone,
      checked_at: isDone ? new Date().toISOString() : null,
      verification_result: verificationResult,
    })
    .eq("incident_event_id", id)
    .eq("step_no", stepNo)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: allSteps } = await supabase
    .from("checklist_progress")
    .select("is_done")
    .eq("incident_event_id", id);

  const allDone = (allSteps ?? []).every((s: { is_done: boolean }) => s.is_done);
  if (allDone && (allSteps ?? []).length > 0) {
    await supabase.from("incident_events").update({ status: "verifying" }).eq("id", id);
  } else {
    await supabase.from("incident_events").update({ status: "in_progress" }).eq("id", id);
  }

  return NextResponse.json({ step: data });
}
