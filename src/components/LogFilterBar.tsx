"use client";

import {
  DATE_RANGE_PRESETS,
  DEFAULT_FILTERS,
  hasActiveFilters,
  toLocalDateTimeInput,
  type LogFilterState,
} from "@/lib/filters";
import type { LogLevel, Severity } from "@/lib/types";

const LEVELS: LogLevel[] = ["INFO", "WARN", "ERROR"];
const SEVERITIES: (Severity | "UNKNOWN")[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNKNOWN"];

interface Props {
  filters: LogFilterState;
  onChange: (next: LogFilterState) => void;
  availableSystems: string[];
  totalLogs: number;
  shownLogs: number;
  totalEvents: number;
  shownEvents: number;
}

export default function LogFilterBar({
  filters,
  onChange,
  availableSystems,
  totalLogs,
  shownLogs,
  totalEvents,
  shownEvents,
}: Props) {
  function toggle<T extends string>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  const active = hasActiveFilters(filters);

  function applyPreset(days: number) {
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    onChange({ ...filters, dateFrom: toLocalDateTimeInput(from), dateTo: toLocalDateTimeInput(to) });
  }

  return (
    <div className="border border-rule rounded bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
          검색 · 필터
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-faint tabular-nums">
            로그 {shownLogs}/{totalLogs}건 · 장애 {shownEvents}/{totalEvents}건 표시
          </span>
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            disabled={!active}
            className="text-xs text-ink-faint hover:text-ink underline disabled:opacity-30 disabled:no-underline"
          >
            필터 초기화
          </button>
        </div>
      </div>

      <input
        value={filters.keyword}
        onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
        placeholder="키워드 검색 (메시지, 시스템, 시그니처…)"
        className="w-full rounded border border-rule bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      />

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
        <FilterGroup label="로그 레벨">
          {LEVELS.map((lvl) => (
            <Chip
              key={lvl}
              label={lvl}
              active={filters.levels.includes(lvl)}
              onClick={() => onChange({ ...filters, levels: toggle(filters.levels, lvl) })}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="위험도">
          {SEVERITIES.map((sev) => (
            <Chip
              key={sev}
              label={sev}
              active={filters.severities.includes(sev)}
              onClick={() =>
                onChange({ ...filters, severities: toggle(filters.severities, sev) })
              }
            />
          ))}
        </FilterGroup>

        {availableSystems.length > 0 && (
          <FilterGroup label="발생 시스템">
            {availableSystems.map((sys) => (
              <Chip
                key={sys}
                label={sys}
                active={filters.systems.includes(sys)}
                onClick={() => onChange({ ...filters, systems: toggle(filters.systems, sys) })}
              />
            ))}
          </FilterGroup>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-ink-faint">기간</span>
        {DATE_RANGE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => applyPreset(preset.days)}
            className="rounded border border-rule bg-bg px-2 py-1 text-ink-soft hover:bg-surface-2"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2 text-ink-faint">
          시작
          <input
            type="datetime-local"
            value={filters.dateFrom}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
            className="rounded border border-rule bg-bg px-2 py-1 text-ink"
          />
        </label>
        <label className="flex items-center gap-2 text-ink-faint">
          종료
          <input
            type="datetime-local"
            value={filters.dateTo}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
            className="rounded border border-rule bg-bg px-2 py-1 text-ink"
          />
        </label>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-ink-faint mr-0.5">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2 py-1 font-medium transition-colors ${
        active
          ? "bg-accent text-white"
          : "border border-rule bg-bg text-ink-soft hover:bg-surface-2"
      }`}
    >
      {label}
    </button>
  );
}
