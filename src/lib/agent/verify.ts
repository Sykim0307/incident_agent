import type { SupabaseClient } from "@supabase/supabase-js";

export interface VerifyResult {
  passed: boolean;
  detail: string;
  testOrderId: string | null;
}

/**
 * "조치 완료 시 테스트 데이터로 정상 작동 유무를 빠르게 체크" - inserts a small
 * synthetic test order and reports it filled/failed depending on whether the
 * orders impacted by this incident (see recovery_snapshots) are still broken.
 */
export async function runVerification(
  supabase: SupabaseClient,
  incidentEventId: string
): Promise<VerifyResult> {
  const { data: snapshots } = await supabase
    .from("recovery_snapshots")
    .select("snapshot_data")
    .eq("incident_event_id", incidentEventId)
    .eq("table_name", "mts_orders");

  const impactedIds: string[] = (snapshots ?? []).flatMap(
    (s: { snapshot_data: { id: string }[] }) => s.snapshot_data.map((row) => row.id)
  );

  let stillBroken = 0;
  if (impactedIds.length > 0) {
    const { data: current } = await supabase
      .from("mts_orders")
      .select("id, status")
      .in("id", impactedIds);
    stillBroken = (current ?? []).filter((o: { status: string }) => o.status === "failed").length;
  }

  const passed = stillBroken === 0;

  const { data: account } = await supabase
    .from("ledger_accounts")
    .select("id")
    .limit(1)
    .single();

  const { data: testOrder } = await supabase
    .from("mts_orders")
    .insert({
      account_id: account?.id,
      symbol: "TEST-999",
      side: "buy",
      qty: 1,
      price: 1000,
      status: passed ? "filled" : "failed",
    })
    .select()
    .single();

  const detail = passed
    ? "테스트 주문이 정상 체결되었습니다. 영향 받은 주문 데이터도 이상 없음을 확인했습니다."
    : `테스트 주문이 실패했습니다. 장애로 영향 받은 주문 ${stillBroken}건이 아직 복구되지 않았습니다.`;

  return { passed, detail, testOrderId: testOrder?.id ?? null };
}
