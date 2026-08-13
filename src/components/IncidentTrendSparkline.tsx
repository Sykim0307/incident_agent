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

  const barWidth = 100 / buckets.length;
  const gap = barWidth * 0.18;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
          지난 24시간 장애 발생 추이
        </h2>
        <span className="text-xs text-ink-faint tabular-nums">총 {total}건</span>
      </div>
      <div className="border border-rule rounded bg-surface p-3">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-20 block">
          {buckets.map((b, i) => {
            const heightPct = (b.count / maxCount) * 32;
            const x = i * barWidth + gap / 2;
            const w = barWidth - gap;
            const y = 36 - heightPct;
            const color = b.worstSeverity ? SEVERITY_COLOR[b.worstSeverity] : "var(--surface-2)";
            return (
              <rect
                key={i}
                x={x}
                y={b.count === 0 ? 35 : y}
                width={w}
                height={b.count === 0 ? 1 : heightPct}
                rx={0.6}
                fill={color}
              >
                <title>{`${b.hourStart.getHours()}시 · ${b.count}건${
                  b.worstSeverity ? ` · 최고 ${b.worstSeverity}` : ""
                }`}</title>
              </rect>
            );
          })}
          {buckets[maxIdx].count > 0 && (
            <text
              x={maxIdx * barWidth + barWidth / 2}
              y={36 - (buckets[maxIdx].count / maxCount) * 32 - 2}
              fontSize={3.2}
              textAnchor="middle"
              fill="var(--ink-faint)"
            >
              {buckets[maxIdx].count}
            </text>
          )}
          <line x1={0} y1={36} x2={100} y2={36} stroke="var(--rule)" strokeWidth={0.3} />
        </svg>
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
