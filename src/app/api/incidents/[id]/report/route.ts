import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { buildIncidentReport } from "@/lib/agent/report";
import type {
  ChecklistStep,
  IncidentEvent,
  IncidentKB,
  NotificationRecord,
  RecoveryAction,
  SystemLog,
} from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Generates a Korean incident-response report from the incident's current
 * state and saves it into incident_events.draft_report for reuse.
 */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/incidents/[id]/report">
) {
  const { id } = await ctx.params;
  const supabase = createServiceSupabaseClient();

  const { data: event } = await supabase
    .from("incident_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: "incident not found" }, { status: 404 });
  }

  const [{ data: steps }, { data: sourceLog }, { data: matched }, { data: recoveryActions }, { data: notifications }, { data: snapshot }] =
    await Promise.all([
      supabase
        .from("checklist_progress")
        .select("*")
        .eq("incident_event_id", id)
        .order("step_no", { ascending: true }),
      event.source_log_id
        ? supabase.from("system_logs").select("*").eq("id", event.source_log_id).maybeSingle()
        : Promise.resolve({ data: null }),
      event.matched_incident_id
        ? supabase.from("incidents_kb").select("*").eq("id", event.matched_incident_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("recovery_actions")
        .select("*")
        .eq("incident_event_id", id)
        .order("executed_at", { ascending: false }),
      supabase
        .from("notifications")
        .select("*, on_call_contacts(name, role)")
        .eq("incident_event_id", id)
        .order("sent_at", { ascending: false }),
      supabase
        .from("recovery_snapshots")
        .select("snapshot_data")
        .eq("incident_event_id", id)
        .eq("table_name", "mts_orders")
        .order("taken_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const impactedOrderCount = ((snapshot?.snapshot_data ?? []) as unknown[]).length;

  const report = buildIncidentReport({
    event: event as IncidentEvent,
    matched: matched as IncidentKB | null,
    sourceLog: sourceLog as SystemLog | null,
    steps: (steps ?? []) as ChecklistStep[],
    recoveryActions: (recoveryActions ?? []) as RecoveryAction[],
    notifications: (notifications ?? []) as (NotificationRecord & {
      on_call_contacts: { name: string; role: string } | null;
    })[],
    impactedOrderCount,
  });

  await supabase.from("incident_events").update({ draft_report: report }).eq("id", id);

  return NextResponse.json({ report });
}
