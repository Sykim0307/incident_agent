import Link from "next/link";
import IncidentHistoryList from "@/components/IncidentHistoryList";
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
        <h1 className="text-2xl font-semibold">장애 이력</h1>
        <p className="text-sm text-ink-soft mt-1">
          지금까지 감지된 모든 장애의 전체 기록입니다. 초록 테두리는 조치 완료, 주황
          테두리는 아직 조치가 필요한 장애입니다. 실시간 대응은{" "}
          <Link href="/" className="text-accent hover:underline">
            24/7 관제센터
          </Link>
          에서 진행하세요.
        </p>
      </div>

      <IncidentHistoryList events={eventList} kbById={kbById} stepsByEvent={stepsByEvent} />
    </div>
  );
}
