import Link from "next/link";
import { SeverityBadge, StatusBadge } from "@/components/SeverityBadge";
import { createAnonSupabaseClient } from "@/lib/supabase/server";
import type { ChecklistStep, IncidentEvent, IncidentKB } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const supabase = createAnonSupabaseClient();

  const [{ data: events }, { data: kb }] = await Promise.all([
    supabase
      .from("incident_events")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(200),
    supabase.from("incidents_kb").select("*"),
  ]);

  const eventList = (events ?? []) as IncidentEvent[];
  const kbById = new Map((kb ?? []).map((k: IncidentKB) => [k.id, k]));

  const { data: steps } = eventList.length
    ? await supabase
        .from("checklist_progress")
        .select("*")
        .in("incident_event_id", eventList.map((e) => e.id))
        .order("step_no", { ascending: true })
    : { data: [] };

  const stepsByEvent = new Map<string, ChecklistStep[]>();
  for (const step of (steps ?? []) as ChecklistStep[]) {
    const list = stepsByEvent.get(step.incident_event_id) ?? [];
    list.push(step);
    stepsByEvent.set(step.incident_event_id, list);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">장애 목록 · 체크리스트 현황</h1>
        <p className="text-sm text-ink-soft mt-1">
          감지된 모든 장애와 대응 체크리스트 진행 상황을 한 화면에서 확인합니다. 항목을
          펼치면 체크리스트를 볼 수 있고, 조치는 상세 페이지에서 진행합니다.
        </p>
      </div>

      {eventList.length === 0 && (
        <p className="text-sm text-ink-faint">아직 감지된 장애가 없습니다.</p>
      )}

      <div className="flex flex-col gap-3">
        {eventList.map((event) => {
          const kbEntry = event.matched_incident_id ? kbById.get(event.matched_incident_id) : null;
          const eventSteps = stepsByEvent.get(event.id) ?? [];
          const doneCount = eventSteps.filter((s) => s.is_done).length;

          return (
            <details
              key={event.id}
              className="border border-rule rounded bg-surface group"
            >
              <summary className="p-3 cursor-pointer flex items-center gap-2 flex-wrap list-none [&::-webkit-details-marker]:hidden">
                <SeverityBadge severity={event.severity} />
                <StatusBadge status={event.status} />
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
