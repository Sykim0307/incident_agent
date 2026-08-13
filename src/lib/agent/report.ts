import type {
  ChecklistStep,
  IncidentEvent,
  IncidentKB,
  NotificationRecord,
  RecoveryAction,
  SystemLog,
} from "@/lib/types";

export interface ReportInput {
  event: IncidentEvent;
  matched: IncidentKB | null;
  sourceLog: SystemLog | null;
  steps: ChecklistStep[];
  recoveryActions: RecoveryAction[];
  notifications: (NotificationRecord & { on_call_contacts: { name: string; role: string } | null })[];
  impactedOrderCount: number;
}

function fmt(dateIso: string | null): string {
  if (!dateIso) return "-";
  return new Date(dateIso).toLocaleString("ko-KR");
}

export function buildIncidentReport(input: ReportInput): string {
  const { event, matched, sourceLog, steps, recoveryActions, notifications, impactedOrderCount } =
    input;

  const lines: string[] = [];

  lines.push(`# 장애 조치 보고서`);
  lines.push("");
  lines.push(`생성 시각: ${new Date().toLocaleString("ko-KR")}`);
  lines.push("");

  lines.push(`## 1. 개요`);
  lines.push(`- 장애 ID: ${event.id}`);
  lines.push(`- 제목: ${matched ? matched.title : "신규 패턴 (지식베이스에 없음)"}`);
  lines.push(`- 발생 시스템: ${event.source_system ?? "미확인"}`);
  lines.push(`- 위험도: ${event.severity}`);
  lines.push(`- 감지 시각: ${fmt(event.detected_at)}`);
  lines.push(`- 현재 상태: ${event.status}`);
  if (event.resolved_at) {
    lines.push(
      `- 종료: ${fmt(event.resolved_at)} (${
        event.resolution_method === "manual" ? "수동 완료 처리" : "자동 복구"
      })`
    );
    if (event.resolution_note) lines.push(`- 종료 메모: ${event.resolution_note}`);
  }
  lines.push("");

  lines.push(`## 2. 감지 정보`);
  lines.push(`- 감지된 에러 시그니처: ${event.detected_signatures.join(", ") || "없음"}`);
  if (matched && event.similarity_score != null) {
    lines.push(`- 유사 과거 사례: ${matched.id} (유사도 ${(event.similarity_score * 100).toFixed(0)}%)`);
  }
  if (sourceLog) {
    lines.push(`- 원본 로그:`);
    lines.push("```");
    lines.push(sourceLog.raw_log);
    lines.push("```");
  }
  lines.push("");

  lines.push(`## 3. 추정 원인`);
  lines.push(matched ? matched.root_cause : "지식베이스에 없는 신규 패턴으로, 에스컬레이션이 필요합니다.");
  lines.push("");

  lines.push(`## 4. 대응 체크리스트 수행 내역`);
  if (steps.length === 0) {
    lines.push("체크리스트 없음.");
  } else {
    for (const step of steps) {
      const mark = step.is_done ? "완료" : "미완료";
      const when = step.checked_at ? ` (${fmt(step.checked_at)})` : "";
      lines.push(`${step.step_no}. [${mark}]${when} ${step.description}`);
    }
  }
  lines.push("");

  lines.push(`## 5. 검증 · 복구 이력`);
  if (recoveryActions.length === 0) {
    lines.push("복구 실행 이력 없음.");
  } else {
    for (const action of recoveryActions) {
      lines.push(`- ${fmt(action.executed_at)}: ${action.result} — ${action.detail ?? ""}`);
    }
  }
  if (impactedOrderCount > 0) {
    lines.push(`- 영향받은 모의 주문 수: ${impactedOrderCount}건`);
  }
  lines.push("");

  lines.push(`## 6. 담당자 알림 발송 내역 (시뮬레이션)`);
  if (notifications.length === 0) {
    lines.push("발송된 알림 없음.");
  } else {
    for (const n of notifications) {
      const contact = n.on_call_contacts ? `${n.on_call_contacts.name} (${n.on_call_contacts.role})` : "당직 담당자";
      lines.push(`- ${fmt(n.sent_at)} [${n.channel.toUpperCase()}] ${contact}: ${n.message}`);
    }
  }
  lines.push("");

  lines.push(`## 7. 결론`);
  lines.push(
    event.status === "resolved"
      ? "본 장애는 체크리스트 조치, 검증, 복구를 거쳐 정상적으로 종료되었습니다."
      : "본 장애는 아직 대응이 진행 중입니다. 상세 페이지에서 후속 조치를 계속하세요."
  );

  return lines.join("\n");
}
