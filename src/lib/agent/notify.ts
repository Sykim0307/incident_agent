import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationRecord, OnCallContact } from "@/lib/types";

export interface NotifyParams {
  incidentEventId: string;
  sourceSystem: string | null;
  severity: string;
  summary: string;
}

export interface NotifyResult {
  sent: NotificationRecord[];
}

/**
 * Fully simulated on-call notification: picks the best-matching on-call
 * contact and inserts a row into `notifications`. This never calls an
 * external SMS/email provider - it only ever writes to the DB, and it
 * never throws, so a notify failure can't break the monitoring pipeline
 * (same degrade-gracefully contract as refineIncidentNarrative).
 */
export async function notifyOnCall(
  supabase: SupabaseClient,
  params: NotifyParams
): Promise<NotifyResult> {
  try {
    const { data: contacts } = await supabase
      .from("on_call_contacts")
      .select("*")
      .eq("active", true);

    const roster = (contacts ?? []) as OnCallContact[];
    if (roster.length === 0) return { sent: [] };

    const scoped = params.sourceSystem
      ? roster.filter((c) => c.system_scope.includes(params.sourceSystem as string))
      : [];
    const catchAll = roster.filter((c) => c.system_scope.length === 0);
    const contact = scoped[0] ?? catchAll[0] ?? roster[0];

    const message = `[모의 알림 · 시연용] ${params.severity} 등급 장애가 '${
      params.sourceSystem ?? "미확인 시스템"
    }'에서 감지되었습니다. ${params.summary}`;

    const { data: inserted, error } = await supabase
      .from("notifications")
      .insert({
        incident_event_id: params.incidentEventId,
        contact_id: contact.id,
        channel: contact.channel,
        recipient: contact.contact_address,
        message,
        status: "sent",
        simulated: true,
      })
      .select()
      .single();

    if (error || !inserted) return { sent: [] };
    return { sent: [inserted as NotificationRecord] };
  } catch {
    return { sent: [] };
  }
}
