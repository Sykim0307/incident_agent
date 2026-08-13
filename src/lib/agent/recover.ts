import type { SupabaseClient } from "@supabase/supabase-js";

export interface RecoverResult {
  result: "success" | "failed";
  detail: string;
  verificationPassed: boolean;
}

/**
 * "시스템 원복 및 DB 데이터 복구" - restores the mock mts_orders rows captured
 * in the incident's recovery_snapshots back to their pre-incident state.
 * Sandbox-only: this never touches anything outside the demo's own mock tables.
 */
export async function runRecovery(
  supabase: SupabaseClient,
  incidentEventId: string
): Promise<RecoverResult> {
  const { data: snapshot } = await supabase
    .from("recovery_snapshots")
    .select("*")
    .eq("incident_event_id", incidentEventId)
    .eq("table_name", "mts_orders")
    .order("taken_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!snapshot) {
    const { data: action } = await supabase
      .from("recovery_actions")
      .insert({
        incident_event_id: incidentEventId,
        snapshot_id: null,
        result: "success",
        verification_passed: true,
        detail: "이 장애 유형은 데이터 영향이 없어 복구할 대상이 없습니다.",
      })
      .select()
      .single();

    await supabase
      .from("incident_events")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolution_method: "recovery",
      })
      .eq("id", incidentEventId);

    return {
      result: "success",
      detail: action?.detail ?? "복구할 대상이 없습니다.",
      verificationPassed: true,
    };
  }

  const rows = snapshot.snapshot_data as { id: string; status: string }[];

  let restoreFailed = false;
  for (const row of rows) {
    const { error } = await supabase
      .from("mts_orders")
      .update({ status: row.status })
      .eq("id", row.id);
    if (error) restoreFailed = true;
  }

  const { data: current } = await supabase
    .from("mts_orders")
    .select("id, status")
    .in(
      "id",
      rows.map((r) => r.id)
    );
  const verificationPassed =
    !restoreFailed &&
    (current ?? []).every(
      (o: { id: string; status: string }) =>
        o.status === rows.find((r) => r.id === o.id)?.status
    );

  const result: "success" | "failed" = restoreFailed || !verificationPassed ? "failed" : "success";
  const detail =
    result === "success"
      ? `주문 ${rows.length}건을 장애 발생 이전 상태로 복구했습니다.`
      : "일부 데이터 복구에 실패했습니다. 수동 확인이 필요합니다.";

  await supabase.from("recovery_actions").insert({
    incident_event_id: incidentEventId,
    snapshot_id: snapshot.id,
    result,
    verification_passed: verificationPassed,
    detail,
  });

  if (result === "success") {
    await supabase
      .from("incident_events")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolution_method: "recovery",
      })
      .eq("id", incidentEventId);
  }

  return { result, detail, verificationPassed };
}
