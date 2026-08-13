"use client";

import { useState } from "react";
import Link from "next/link";
import { SeverityBadge, StatusBadge } from "@/components/SeverityBadge";
import type { ChecklistStep, IncidentEvent, IncidentKB } from "@/lib/types";

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];

interface Props {
  events: IncidentEvent[];
  kbById: Map<string, IncidentKB>;
  stepsByEvent: Map<string, ChecklistStep[]>;
}

export default function IncidentHistoryList({ events, kbById, stepsByEvent }: Props) {
  const [severities, setSeverities] = useState<string[]>([]);

  function toggle(sev: string) {
    setSeverities((prev) => (prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev]));
  }

  const filtered =
    severities.length > 0 ? events.filter((e) => severities.includes(e.severity)) : events;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-ink-faint">위험도 필터:</span>
        {SEVERITIES.map((sev) => (
          <button
            key={sev}
            onClick={() => toggle(sev)}
            className={`rounded border px-2 py-1 font-medium ${
              severities.includes(sev)
                ? "border-accent-soft bg-accent-soft text-accent-ink"
                : "border-rule bg-surface text-ink-soft hover:bg-surface-2"
            }`}
          >
            {sev}
          </button>
        ))}
        {severities.length > 0 && (
          <button
            onClick={() => setSeverities([])}
            className="text-ink-faint underline hover:text-ink"
          >
            필터 초기화
          </button>
        )}
        <span className="ml-auto text-ink-faint tabular-nums">
          {filtered.length}/{events.length}건
        </span>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-ink-faint">
          {events.length === 0 ? "아직 감지된 장애가 없습니다." : "조건에 맞는 장애가 없습니다."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((event) => {
          const kbEntry = event.matched_incident_id ? kbById.get(event.matched_incident_id) : null;
          const eventSteps = stepsByEvent.get(event.id) ?? [];
          const doneCount = eventSteps.filter((s) => s.is_done).length;
          const isResolved = event.status === "resolved";

          return (
            <details
              key={event.id}
              className={`border-l-4 border-y border-r rounded bg-surface group ${
                isResolved
                  ? "border-l-sev-ok border-y-rule border-r-rule"
                  : "border-l-sev-high border-y-rule border-r-rule"
              }`}
            >
              <summary className="p-3 cursor-pointer flex items-center gap-2 flex-wrap list-none [&::-webkit-details-marker]:hidden">
                <SeverityBadge severity={event.severity} />
                <StatusBadge status={event.status} />
                <span
                  className={`text-xs font-medium ${isResolved ? "text-sev-ok" : "text-sev-high"}`}
                >
                  {isResolved ? "조치 완료" : "조치 필요"}
                </span>
                {event.source_system && (
                  <span className="text-xs text-ink-faint">{event.source_system}</span>
                )}
                <span className="text-sm flex-1 min-w-[10rem]">
                  {kbEntry ? kbEntry.title : "신규 패턴 (지식베이스에 없음)"}
                </span>
                {eventSteps.length > 0 && (
                  <span className="text-xs text-ink-faint tabular-nums">
                    체크리스트 {doneCount}/{eventSteps.length}
                  </span>
                )}
                <span className="text-xs text-ink-faint whitespace-nowrap">
                  {new Date(event.detected_at).toLocaleString("ko-KR")}
                </span>
              </summary>
              <div className="border-t border-rule p-3 flex flex-col gap-2">
                {eventSteps.length === 0 ? (
                  <p className="text-xs text-ink-faint">이 장애에는 체크리스트가 없습니다.</p>
                ) : (
                  <ol className="flex flex-col gap-1.5">
                    {eventSteps.map((step) => (
                      <li key={step.step_no} className="flex items-start gap-2 text-sm">
                        <span className={step.is_done ? "text-sev-ok" : "text-ink-faint"}>
                          {step.is_done ? "✓" : "○"}
                        </span>
                        <span className={step.is_done ? "text-ink-faint line-through" : "text-ink"}>
                          {step.step_no}. {step.description}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                <Link
                  href={`/incidents/${event.id}`}
                  className="text-xs text-accent hover:underline self-start mt-1"
                >
                  상세 페이지에서 조치하기 →
                </Link>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
