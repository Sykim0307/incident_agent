import type { IncidentEvent } from "@/lib/types";

export const MONITORED_SYSTEMS = [
  "HTS",
  "MTS",
  "웹 트레이딩",
  "OpenAPI",
  "RPA",
  "대고객 알림",
  "계정계",
  "계정계 배치",
  "리포트 배치",
];

export const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  UNKNOWN: 0,
};

export const SEVERITY_COLOR_VARS: Record<string, { fg: string; bg: string }> = {
  CRITICAL: { fg: "var(--sev-critical)", bg: "var(--sev-critical-bg)" },
  HIGH: { fg: "var(--sev-high)", bg: "var(--sev-high-bg)" },
  MEDIUM: { fg: "var(--sev-medium)", bg: "var(--sev-medium-bg)" },
  LOW: { fg: "var(--sev-low)", bg: "var(--sev-low-bg)" },
  UNKNOWN: { fg: "var(--sev-unknown)", bg: "var(--sev-unknown-bg)" },
};

export interface SystemHealth {
  system: string;
  severity: string | null;
  openCount: number;
}

export function computeSystemHealth(system: string, events: IncidentEvent[]): SystemHealth {
  const open = events.filter((e) => e.status !== "resolved" && e.source_system === system);
  if (open.length === 0) return { system, severity: null, openCount: 0 };
  const worst = open.reduce((acc, e) =>
    (SEVERITY_RANK[e.severity] ?? 0) > (SEVERITY_RANK[acc.severity] ?? 0) ? e : acc
  );
  return { system, severity: worst.severity, openCount: open.length };
}

export function computeAllSystemHealth(
  systems: string[],
  events: IncidentEvent[]
): SystemHealth[] {
  return systems.map((system) => computeSystemHealth(system, events));
}
