import { SeverityBadge } from "@/components/SeverityBadge";
import { createAnonSupabaseClient } from "@/lib/supabase/server";
import type { IncidentKB } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage() {
  const supabase = createAnonSupabaseClient();
  const { data } = await supabase.from("incidents_kb").select("*").order("id");
  const items = (data ?? []) as IncidentKB[];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">장애 지식베이스</h1>
        <p className="text-sm text-ink-soft mt-1">
          Agent가 새 로그와 비교하는 과거 장애 사례 {items.length}건입니다. 실제 운영에서는
          해결된 신규 장애가 여기 자동으로 누적됩니다.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((inc) => (
          <details
            key={inc.id}
            className="border border-rule rounded bg-surface p-4 group"
          >
            <summary className="flex items-center gap-2 cursor-pointer flex-wrap list-none">
              <span className="font-mono text-xs text-ink-faint">{inc.id}</span>
              <SeverityBadge severity={inc.severity} />
              <span className="text-sm font-medium">{inc.title}</span>
              <span className="text-xs text-ink-faint ml-auto">{inc.system_name}</span>
            </summary>
            <div className="mt-3 flex flex-col gap-3 text-sm text-ink-soft">
              <p>{inc.symptoms}</p>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-faint mb-1">원인</p>
                <p>{inc.root_cause}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-faint mb-1">
                  대응 체크리스트
                </p>
                <ol className="list-decimal list-inside flex flex-col gap-1">
                  {inc.resolution.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
              <p className="text-xs text-ink-faint">
                평균 해결 시간: {inc.avg_resolution_min}분
              </p>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
