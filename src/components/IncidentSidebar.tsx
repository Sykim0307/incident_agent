"use client";

import IncidentGroupCard from "@/components/IncidentGroupCard";
import type { IncidentGroup, IncidentSortMode } from "@/lib/incidentGroups";

interface Props {
  groups: IncidentGroup[];
  selectedKey: string | null;
  onSelect: (group: IncidentGroup) => void;
  nowMs: number | null;
  sortMode: IncidentSortMode;
  onSortModeChange: (mode: IncidentSortMode) => void;
  keyword: string;
  onKeywordChange: (keyword: string) => void;
}

export default function IncidentSidebar({
  groups,
  selectedKey,
  onSelect,
  nowMs,
  sortMode,
  onSortModeChange,
  keyword,
  onKeywordChange,
}: Props) {
  const visible = keyword.trim()
    ? groups.filter((g) => g.title.toLowerCase().includes(keyword.trim().toLowerCase()))
    : groups;

  return (
    <div className="flex flex-col gap-3 lg:w-[280px] lg:flex-shrink-0">
      <div className="sticky top-0 z-10 bg-bg pb-2 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            감지된 장애
          </h2>
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

      <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto pr-1">
        {visible.length === 0 && (
          <p className="text-sm text-ink-faint p-3 border border-rule rounded bg-surface">
            {groups.length === 0 ? "아직 감지된 장애가 없습니다." : "검색 결과가 없습니다."}
          </p>
        )}
        {visible.map((group) => (
          <IncidentGroupCard
            key={group.key}
            group={group}
            selected={group.key === selectedKey}
            nowMs={nowMs}
            onClick={() => onSelect(group)}
          />
        ))}
      </div>
    </div>
  );
}
