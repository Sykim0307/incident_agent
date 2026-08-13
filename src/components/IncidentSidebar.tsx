"use client";

import { SeverityBadge } from "@/components/SeverityBadge";
import { formatRelativeTime } from "@/lib/time";
import { SEVERITY_RANK } from "@/lib/systemHealth";
import type { IncidentEvent, IncidentKB } from "@/lib/types";

export type IncidentSortMode = "severity" | "recent";

interface Props {
  events: IncidentEvent[];
  kbById: Map<string, IncidentKB>;
  selectedId: string | null;
  onSelect: (event: IncidentEvent) => void;
  nowMs: number | null;
  sortMode: IncidentSortMode;
  onSortModeChange: (mode: IncidentSortMode) => void;
  keyword: string;
  onKeywordChange: (keyword: string) => void;
}

export function sortEvents(events: IncidentEvent[], mode: IncidentSortMode): IncidentEvent[] {
  const sorted = [...events];
  sorted.sort((a, b) => {
    if (mode === "severity") {
      const rankDiff = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
      if (rankDiff !== 0) return rankDiff;
    }
    return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
  });
  return sorted;
}

export default function IncidentSidebar({
  events,
  kbById,
  selectedId,
  onSelect,
  nowMs,
  sortMode,
  onSortModeChange,
  keyword,
  onKeywordChange,
}: Props) {
  const byKeyword = keyword.trim()
    ? events.filter((e) => {
        const kb = e.matched_incident_id ? kbById.get(e.matched_incident_id) : null;
        const haystack = `${kb?.title ?? ""} ${e.source_system ?? ""}`.toLowerCase();
        return haystack.includes(keyword.trim().toLowerCase());
      })
    : events;
  const visible = sortEvents(byKeyword, sortMode);

  return (
    <div className="flex flex-col gap-3 lg:w-[280px] lg:flex-shrink-0">
      <div className="sticky top-0 z-10 bg-bg pb-2 flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="font-mono text-xs uppercase tracking-wide text-ink-faint">
              감지된 장애
            </span>
            <span className="text-ink-faint text-[11px] ml-1.5">Detected Incidents</span>
          </div>
          <span className="text-xs text-ink-faint tabular-nums">{visible.length}건</span>
        </div>
        <input
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="장애 검색…"
          className="w-full rounded border border-rule bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="flex gap-1.5 text-xs">
          <button
            onClick={() => onSortModeChange("severity")}
            className={`rounded border px-2 py-1 ${
              sortMode === "severity"
                ? "border-accent-soft bg-accent-soft text-accent-ink"
                : "border-rule bg-surface text-ink-soft hover:bg-surface-2"
            }`}
          >
            심각도순
          </button>
          <button
            onClick={() => onSortModeChange("recent")}
            className={`rounded border px-2 py-1 ${
              sortMode === "recent"
                ? "border-accent-soft bg-accent-soft text-accent-ink"
                : "border-rule bg-surface text-ink-soft hover:bg-surface-2"
            }`}
          >
            최근순
          </button>
        </div>
      </div>

      <div className="flex flex-col max-h-[70vh] overflow-y-auto border border-rule rounded bg-surface divide-y divide-rule">
        {visible.length === 0 && (
          <p className="text-sm text-ink-faint p-3">
            {events.length === 0 ? "아직 감지된 장애가 없습니다." : "검색 결과가 없습니다."}
          </p>
        )}
        {visible.map((event) => {
          const kb = event.matched_incident_id ? kbById.get(event.matched_incident_id) : null;
          const isResolved = event.status === "resolved";
          const isSelected = event.id === selectedId;

          return (
            <button
              key={event.id}
              onClick={() => onSelect(event)}
              className={`flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                isSelected ? "bg-accent-soft" : "hover:bg-surface-2"
              }`}
            >
              {isResolved ? (
                <span className="flex-shrink-0 rounded border border-rule px-2 py-0.5 text-[11px] text-ink-faint whitespace-nowrap">
                  해결됨
                </span>
              ) : (
                <span className="flex-shrink-0">
                  <SeverityBadge severity={event.severity} />
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[13px] font-semibold truncate ${
                    isResolved ? "text-ink-faint" : "text-ink"
                  }`}
                >
                  {kb ? kb.title : `신규 패턴 (${event.source_system ?? "미확인"})`}
                </p>
                <p className="text-[11px] text-ink-faint truncate">
                  {event.source_system ?? "미확인"} ·{" "}
                  {nowMs != null ? formatRelativeTime(event.detected_at, nowMs) : "…"}
                  {event.similarity_score != null && kb
                    ? ` · 유사도 ${(event.similarity_score * 100).toFixed(0)}%`
                    : ""}
                </p>
              </div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0 text-ink-faint opacity-50"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
