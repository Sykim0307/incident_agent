"use client";

import { computeAllSystemHealth, MONITORED_SYSTEMS, SEVERITY_COLOR_VARS } from "@/lib/systemHealth";
import type { IncidentEvent } from "@/lib/types";

export default function SystemHealthBar({ events }: { events: IncidentEvent[] }) {
  const health = computeAllSystemHealth(MONITORED_SYSTEMS, events);
  const degradedCount = health.filter((h) => h.severity).length;

  return (
    <div className="border border-rule rounded bg-surface p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
          증권 IT 시스템 헬스체크
        </h2>
        <span className={`text-xs ${degradedCount > 0 ? "text-sev-critical" : "text-sev-ok"}`}>
          {degradedCount > 0 ? `${degradedCount}개 시스템 이상` : "전체 시스템 정상"}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {health.map((h) => {
          const colors = h.severity ? SEVERITY_COLOR_VARS[h.severity] : null;
          return (
            <div
              key={h.system}
              className="rounded border px-2.5 py-2 flex items-center gap-2"
              style={{
                borderColor: colors?.fg ?? "var(--rule)",
                backgroundColor: colors?.bg ?? "var(--surface-2)",
              }}
              title={h.severity ? `${h.system}: ${h.severity} 장애 ${h.openCount}건` : `${h.system}: 정상`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: colors?.fg ?? "var(--sev-ok)" }}
              />
              <span className="text-xs font-medium truncate" style={{ color: colors?.fg ?? "var(--ink-soft)" }}>
                {h.system}
              </span>
              <span className="text-[10px] text-ink-faint ml-auto whitespace-nowrap">
                {h.severity ? `${h.severity} · ${h.openCount}건` : "정상"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
