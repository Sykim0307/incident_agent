import { notFound } from "next/navigation";
import IncidentDetail from "@/components/IncidentDetail";
import { createAnonSupabaseClient } from "@/lib/supabase/server";
import type {
  ChecklistStep,
  IncidentEvent,
  IncidentKB,
  RecoveryAction,
  SystemLog,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function IncidentPage({
  params,
}: PageProps<"/incidents/[id]">) {
  const { id } = await params;
  const supabase = createAnonSupabaseClient();

  const { data: event } = await supabase
    .from("incident_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!event) notFound();

  const [{ data: steps }, { data: sourceLog }, { data: matched }, { data: actions }] =
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
        ? supabase
            .from("incidents_kb")
            .select("*")
            .eq("id", event.matched_incident_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("recovery_actions")
        .select("*")
        .eq("incident_event_id", id)
        .order("executed_at", { ascending: false }),
    ]);

  return (
    <IncidentDetail
      event={event as IncidentEvent}
      steps={(steps ?? []) as ChecklistStep[]}
      sourceLog={sourceLog as SystemLog | null}
      matched={matched as IncidentKB | null}
      recoveryActions={(actions ?? []) as RecoveryAction[]}
    />
  );
}
