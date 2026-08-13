import type { IncidentEvent, IncidentKB, LogLevel, Severity, SystemLog } from "@/lib/types";

export interface LogFilterState {
  keyword: string;
  levels: LogLevel[];
  severities: (Severity | "UNKNOWN")[];
  systems: string[];
  dateFrom: string;
  dateTo: string;
}

export const DEFAULT_FILTERS: LogFilterState = {
  keyword: "",
  levels: [],
  severities: [],
  systems: [],
  dateFrom: "",
  dateTo: "",
};

export function hasActiveFilters(f: LogFilterState): boolean {
  return (
    f.keyword.trim() !== "" ||
    f.levels.length > 0 ||
    f.severities.length > 0 ||
    f.systems.length > 0 ||
    f.dateFrom !== "" ||
    f.dateTo !== ""
  );
}

export function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export interface DateRangePreset {
  label: string;
  days: number;
}

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  { label: "최근 1일", days: 1 },
  { label: "최근 1주일", days: 7 },
  { label: "최근 1개월", days: 30 },
  { label: "최근 1년", days: 365 },
];

function inDateRange(iso: string, from: string, to: string): boolean {
  const t = new Date(iso).getTime();
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime()) return false;
  return true;
}

export function filterLogs(logs: SystemLog[], f: LogFilterState): SystemLog[] {
  const keyword = f.keyword.trim().toLowerCase();
  return logs.filter((log) => {
    if (f.levels.length > 0 && !f.levels.includes(log.level as LogLevel)) return false;
    if (f.systems.length > 0 && !f.systems.includes(log.source_system)) return false;
    if (!inDateRange(log.created_at, f.dateFrom, f.dateTo)) return false;
    if (keyword) {
      const haystack = `${log.message} ${log.raw_log} ${log.source_system}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
}

export function filterEvents(
  events: IncidentEvent[],
  f: LogFilterState,
  kbById: Map<string, IncidentKB>
): IncidentEvent[] {
  const keyword = f.keyword.trim().toLowerCase();
  return events.filter((event) => {
    if (f.severities.length > 0 && !f.severities.includes(event.severity)) return false;
    if (f.systems.length > 0 && event.source_system && !f.systems.includes(event.source_system))
      return false;
    if (!inDateRange(event.detected_at, f.dateFrom, f.dateTo)) return false;
    if (keyword) {
      const kb = event.matched_incident_id ? kbById.get(event.matched_incident_id) : null;
      const haystack = [
        kb?.title ?? "",
        kb?.system_name ?? "",
        event.source_system ?? "",
        event.llm_summary ?? "",
        ...event.detected_signatures,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
}
