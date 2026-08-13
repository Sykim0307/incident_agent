"use client";

import { useMemo } from "react";
import type { IncidentEvent } from "@/lib/types";

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  UNKNOWN: 0,
};

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "var(--sev-critical)",
  HIGH: "var(--sev-high)",
  MEDIUM: "var(--sev-medium)",
  LOW: "var(--sev-ok)",
  UNKNOWN: "var(--sev-unknown)",
};

const LEGEND: { key: string; label: string }[] = [
  { key: "CRITICAL", label: "CRITICAL" },
  { key: "HIGH", label: "HIGH" },
  { key: "MEDIUM", label: "MEDIUM" },
  { key: "LOW", label: "LOW" },
  { key: "UNKNOWN", label: "UNKNOWN" },
];

interface Bucket {
  hourStart: Date;
  count: number;
  worstSeverity: string | null;
}

function buildBuckets(events: IncidentEvent[]): Bucket[] {
  const now = new Date();
  const buckets: Bucket[] = Array.from({ length: 24 }, (_, i) => {
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);
    hourStart.setHours(hourStart.getHours() - (23 - i));
    return { hourStart, count: 0, worstSeverity: null };
  });

  for (const event of events) {
    const t = new Date(event.detected_at);
    const idx = buckets.findIndex((b, i) => {
      const next = i < 23 ? buckets[i + 1].hourStart : new Date(now.getTime() + 3600_000);
      return t >= b.hourStart && t < next;
    });
    if (idx === -1) continue;
    const bucket = buckets[idx];
    bucket.count += 1;
    if (
      bucket.worstSeverity === null ||
      (SEVERITY_RANK[event.severity] ?? 0) > (SEVERITY_RANK[bucket.worstSeverity] ?? 0)
    ) {
      bucket.worstSeverity = event.severity;
    }
  }

  return buckets;
}

export default function IncidentTrendSparkline({ events }: { events: IncidentEvent[] }) {
  const buckets = useMemo(() => buildBuckets(events), [events]);
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const maxIdx = buckets.reduce(
    (best, b, i) => (b.count > buckets[best].count ? i : best),
    0
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            지난 24시간 장애 발생 추이
          </h2>
          <p className="text-xs text-ink-faint mt-0.5">
            시간대별 장애 발생 빈도와 심각도 변화를 보여줍니다.
          </p>
        </div>
        <span className="text-xs text-ink-faint tabular-nums">총 {total}건</span>
      </div>
      <div className="border border-rule rounded bg-surface p-3">
        <div className="flex items-end gap-[3px]" style={{ height: 64 }}>
          {buckets.map((b, i) => {
            const heightPct =
              b.count === 0 ? 3 : Math.max(8, Math.sqrt(b.count / maxCount) * 100);
            const color = b.worstSeverity ? SEVERITY_COLOR[b.worstSeverity] : "var(--surface-2)";
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end h-full"
                title={`${b.hourStart.getHours()}시 · ${b.count}건${
                  b.worstSeverity ? ` · 최고 ${b.worstSeverity}` : ""
                }`}
              >
                {i === maxIdx && b.count > 0 && (
                  <span className="text-[9px] text-ink-faint leading-none mb-0.5 tabular-nums">
                    {b.count}
                  </span>
                )}
                <div
                  className="w-full rounded-t-sm transition-all duration-700 ease-out"
                  style={{ height: `${heightPct}%`, backgroundColor: color }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-[3px] mt-1">
          {buckets.map((b, i) => (
            <div key={i} className="flex-1 text-center text-[9px] text-ink-faint tabular-nums">
              {i % 4 === 0 ? `${b.hourStart.getHours()}시` : ""}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap text-[10px] text-ink-faint">
        {LEGEND.map((l) => (
          <span key={l.key} className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ backgroundColor: SEVERITY_COLOR[l.key] }}
            />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
