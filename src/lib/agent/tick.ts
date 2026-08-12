import type { SupabaseClient } from "@supabase/supabase-js";
import { extractErrorSignatures } from "@/lib/agent/signatures";
import { searchSimilarIncidents, MATCH_THRESHOLD } from "@/lib/agent/similarity";
import { pickRandomLog } from "@/lib/agent/scenarios";
import { refineIncidentNarrative } from "@/lib/claude";
import type { IncidentKB, MtsOrder } from "@/lib/types";

const ESCALATION_CHECKLIST = [
  "유사 과거 사례가 발견되지 않았습니다. 신규 장애 패턴일 수 있습니다.",
  "당직 시니어 엔지니어에게 즉시 에스컬레이션하세요.",
  "해결 후 본 사례를 지식베이스(incidents_kb)에 등록해 다음 대응 속도를 높이세요.",
];

export interface TickResult {
  log: { id: string; source_system: string; level: string; message: string; raw_log: string };
  incidentEventId: string | null;
}

/**
 * One "heartbeat" of the 24/7 monitoring agent: emits one log line and, if it's
 * abnormal, runs the full detect -> match -> checklist -> (optional) impact
 * simulation -> LLM narrative pipeline. Called by both the Vercel Cron route
 * and the manual "지금 로그 생성" demo button, so the live demo never depends
 * on cron timing.
 */
export async function runMonitoringTick(supabase: SupabaseClient): Promise<TickResult> {
  const template = pickRandomLog();

  const { data: insertedLog, error: logError } = await supabase
    .from("system_logs")
    .insert({
      source_system: template.source_system,
      level: template.level,
      message: template.message,
      raw_log: template.raw_log,
    })
    .select()
    .single();

  if (logError || !insertedLog) {
    throw new Error(`failed to insert system_log: ${logError?.message}`);
  }

  if (template.level !== "ERROR") {
    return { log: insertedLog, incidentEventId: null };
  }

  const signatures = extractErrorSignatures(template.raw_log);

  const { data: kb } = await supabase.from("incidents_kb").select("*");
  const knowledgeBase = (kb ?? []) as IncidentKB[];

  const matches = searchSimilarIncidents(
    `${template.source_system} ${template.raw_log}`,
    knowledgeBase,
    1
  );
  const best = matches[0];
  const isMatch = best && best.score >= MATCH_THRESHOLD;

  const severity = isMatch ? best.incident.severity : "UNKNOWN";
  const checklist = isMatch ? best.incident.resolution : ESCALATION_CHECKLIST;

  const { data: incidentEvent, error: eventError } = await supabase
    .from("incident_events")
    .insert({
      source_log_id: insertedLog.id,
      detected_signatures: signatures,
      matched_incident_id: isMatch ? best.incident.id : null,
      similarity_score: best ? best.score : 0,
      severity,
      status: "open",
      checklist,
    })
    .select()
    .single();

  if (eventError || !incidentEvent) {
    throw new Error(`failed to insert incident_event: ${eventError?.message}`);
  }

  await supabase.from("checklist_progress").insert(
    checklist.map((description: string, i: number) => ({
      incident_event_id: incidentEvent.id,
      step_no: i + 1,
      description,
    }))
  );

  if (isMatch && template.impact === "mts_orders_fail") {
    await simulateMtsImpact(supabase, incidentEvent.id);
  }

  const narrative = await refineIncidentNarrative({
    detectedSignatures: signatures,
    severity,
    matchedIncident: isMatch ? best.incident : null,
    similarityScore: best ? best.score : 0,
    checklist,
  });

  if (narrative) {
    await supabase
      .from("incident_events")
      .update({ llm_summary: narrative })
      .eq("id", incidentEvent.id);
  }

  return { log: insertedLog, incidentEventId: incidentEvent.id };
}

/**
 * Perturbs a handful of recent "filled" mock MTS orders to "failed", after taking
 * a snapshot of their original state. This gives the recovery flow something real
 * (within the sandbox) to restore.
 */
async function simulateMtsImpact(supabase: SupabaseClient, incidentEventId: string) {
  const { data: victims } = await supabase
    .from("mts_orders")
    .select("*")
    .eq("status", "filled")
    .order("created_at", { ascending: false })
    .limit(3);

  const targets = (victims ?? []) as MtsOrder[];
  if (targets.length === 0) return;

  await supabase.from("recovery_snapshots").insert({
    incident_event_id: incidentEventId,
    table_name: "mts_orders",
    snapshot_data: targets,
    label: "before_incident",
  });

  await supabase
    .from("mts_orders")
    .update({ status: "failed" })
    .in(
      "id",
      targets.map((t) => t.id)
    );
}
