import { SEVERITY_RANK } from "@/lib/systemHealth";
import type { IncidentEvent, IncidentKB } from "@/lib/types";

export interface IncidentGroup {
  key: string;
  title: string;
  severity: string;
  count: number;
  latestDetectedAt: string;
  status: "open" | "resolved";
  representative: IncidentEvent;
  members: IncidentEvent[];
}

/**
 * Lightweight event-correlation: groups incident_events that matched the
 * same knowledge-base entry (or, for unmatched "신규 패턴" events, the same
 * source system) into a single card, instead of listing every individual
 * detection separately. This is a presentation-layer aggregation over
 * matched_incident_id - there is no separate "incident group" table.
 */
export function groupIncidents(
  events: IncidentEvent[],
  kbById: Map<string, IncidentKB>
): IncidentGroup[] {
  const byKey = new Map<string, IncidentEvent[]>();
  for (const event of events) {
    const key = event.matched_incident_id ?? `unknown:${event.source_system ?? "미확인"}`;
    const list = byKey.get(key) ?? [];
    list.push(event);
    byKey.set(key, list);
  }

  const groups: IncidentGroup[] = [];
  for (const [key, members] of byKey) {
    const sorted = [...members].sort(
      (a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
    );
    const representative = sorted[0];
    const kb = representative.matched_incident_id
      ? kbById.get(representative.matched_incident_id)
      : null;

    groups.push({
      key,
      title: kb ? kb.title : `신규 패턴 (${representative.source_system ?? "미확인 시스템"})`,
      severity: representative.severity,
      count: members.length,
      latestDetectedAt: representative.detected_at,
      status: members.some((m) => m.status !== "resolved") ? "open" : "resolved",
      representative,
      members: sorted,
    });
  }

  return groups;
}

export type IncidentSortMode = "severity" | "recent";

export function sortGroups(groups: IncidentGroup[], mode: IncidentSortMode): IncidentGroup[] {
  const sorted = [...groups];
  sorted.sort((a, b) => {
    if (mode === "severity") {
      const rankDiff = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
      if (rankDiff !== 0) return rankDiff;
    }
    return new Date(b.latestDetectedAt).getTime() - new Date(a.latestDetectedAt).getTime();
  });
  return sorted;
}
