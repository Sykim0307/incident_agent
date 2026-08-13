import { StatTile } from "@/components/StatTile";
import type { LedgerAccount, MtsOrder } from "@/lib/types";

interface SnapshotOrder {
  id: string;
  account_id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  status: string;
}

interface Props {
  snapshotOrders: SnapshotOrder[];
  accounts: LedgerAccount[];
  currentOrders: MtsOrder[];
}

export default function IncidentImpact({ snapshotOrders, accounts, currentOrders }: Props) {
  if (snapshotOrders.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
          영향 범위 및 예상 피해
        </h2>
        <p className="text-sm text-ink-soft">
          이 장애 유형은 데이터 영향이 없어 별도로 측정할 피해 범위가 없습니다.
        </p>
      </section>
    );
  }

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const currentById = new Map(currentOrders.map((o) => [o.id, o]));

  const affectedAccountIds = new Set(snapshotOrders.map((o) => o.account_id));
  const stillBroken = snapshotOrders.filter((o) => currentById.get(o.id)?.status === "failed");
  const notionalTotal = snapshotOrders.reduce((sum, o) => sum + o.qty * o.price, 0);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
        영향 범위 및 예상 피해
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="영향 계좌 수" value={affectedAccountIds.size} />
        <StatTile label="영향 주문 수" value={snapshotOrders.length} />
        <StatTile label="아직 미복구" value={stillBroken.length} tone={stillBroken.length > 0 ? "critical" : undefined} />
        <StatTile label="모의 명목 금액 추정" value={`${notionalTotal.toLocaleString("ko-KR")}원`} />
      </div>
      <p className="text-[11px] text-ink-faint">
        * 모의 명목 금액 추정치는 영향 주문의 수량×가격 합산이며, 실제 손익/피해액이 아닌 시연용
        참고 수치입니다.
      </p>
      <div className="border border-rule rounded bg-surface divide-y divide-rule overflow-x-auto">
        <div className="grid grid-cols-5 gap-2 p-2 text-[11px] text-ink-faint font-mono uppercase">
          <span>계좌</span>
          <span>종목</span>
          <span>구분/수량</span>
          <span>원 상태</span>
          <span>현재 상태</span>
        </div>
        {snapshotOrders.map((o) => {
          const account = accountById.get(o.account_id);
          const current = currentById.get(o.id);
          return (
            <div key={o.id} className="grid grid-cols-5 gap-2 p-2 text-xs items-center">
              <span className="truncate">
                {account ? `${account.customer_name} (${account.account_no})` : o.account_id}
              </span>
              <span>{o.symbol}</span>
              <span>
                {o.side === "buy" ? "매수" : "매도"} {o.qty}주
              </span>
              <span className="text-ink-faint">{o.status}</span>
              <span className={current?.status === "failed" ? "text-sev-critical" : "text-sev-ok"}>
                {current?.status ?? "-"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
