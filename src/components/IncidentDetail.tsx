"use client";

import { useState } from "react";
import Link from "next/link";
import { SeverityBadge, StatusBadge } from "@/components/SeverityBadge";
import type {
  ChecklistStep,
  IncidentEvent,
  IncidentKB,
  RecoveryAction,
  SystemLog,
} from "@/lib/types";

interface Props {
  event: IncidentEvent;
  steps: ChecklistStep[];
  sourceLog: SystemLog | null;
  matched: IncidentKB | null;
  recoveryActions: RecoveryAction[];
}

export default function IncidentDetail({
  event,
  steps: initialSteps,
  sourceLog,
  matched,
  recoveryActions: initialActions,
}: Props) {
  const [steps, setSteps] = useState(initialSteps);
  const [status, setStatus] = useState(event.status);
  const [verifyResult, setVerifyResult] = useState<{
    passed: boolean;
    detail: string;
  } | null>(null);
  const [recoverResult, setRecoverResult] = useState<{
    result: string;
    detail: string;
  } | null>(null);
  const [recoveryActions, setRecoveryActions] = useState(initialActions);
  const [busy, setBusy] = useState<string | null>(null);

  const allStepsDone = steps.length > 0 && steps.every((s) => s.is_done);

  async function toggleStep(step: ChecklistStep) {
    setBusy(`step-${step.step_no}`);
    try {
      const res = await fetch(`/api/incidents/${event.id}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step_no: step.step_no, is_done: !step.is_done }),
      });
      const { step: updated } = await res.json();
      setSteps((prev) => prev.map((s) => (s.step_no === step.step_no ? updated : s)));
      setStatus(allNowDone(steps, step.step_no) ? "verifying" : "in_progress");
    } finally {
      setBusy(null);
    }
  }

  function allNowDone(current: ChecklistStep[], justToggledStepNo: number) {
    return current.every((s) =>
      s.step_no === justToggledStepNo ? !s.is_done : s.is_done
    );
  }

  async function runVerify() {
    setBusy("verify");
    setVerifyResult(null);
    try {
      const res = await fetch(`/api/incidents/${event.id}/verify`, { method: "POST" });
      setVerifyResult(await res.json());
    } finally {
      setBusy(null);
    }
  }

  async function runRecover() {
    setBusy("recover");
    setRecoverResult(null);
    try {
      const res = await fetch(`/api/incidents/${event.id}/recover`, { method: "POST" });
      const data = await res.json();
      setRecoverResult(data);
      setRecoveryActions((prev) => [
        {
          id: crypto.randomUUID(),
          incident_event_id: event.id,
          snapshot_id: null,
          executed_at: new Date().toISOString(),
          result: data.result,
          verification_passed: data.verificationPassed,
          detail: data.detail,
        },
        ...prev,
      ]);
      if (data.result === "success") setStatus("resolved");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 flex flex-col gap-8">
      <div>
        <Link href="/" className="text-xs text-ink-faint hover:text-ink">
          ← 대시보드로
        </Link>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <SeverityBadge severity={event.severity} />
          <StatusBadge status={status} />
          <span className="text-xs text-ink-faint">
            감지 시각 {new Date(event.detected_at).toLocaleString("ko-KR")}
          </span>
        </div>
        <h1 className="text-2xl font-semibold mt-2">
          {matched ? matched.title : "신규 패턴 - 지식베이스에 없는 장애"}
        </h1>
        {matched && event.similarity_score != null && (
          <p className="text-sm text-ink-soft mt-1">
            {matched.id} 사례와 유사도 {(event.similarity_score * 100).toFixed(0)}%로 매칭됨
          </p>
        )}
      </div>

      {sourceLog && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            원본 로그
          </h2>
          <pre className="border border-rule rounded bg-surface p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto">
            {sourceLog.raw_log}
          </pre>
          <p className="text-xs text-ink-faint">
            감지된 에러 시그니처:{" "}
            {event.detected_signatures.length > 0
              ? event.detected_signatures.join(", ")
              : "없음"}
          </p>
        </section>
      )}

      {matched && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            추정 원인
          </h2>
          <p className="text-sm text-ink-soft">{matched.root_cause}</p>
        </section>
      )}

      {event.llm_summary && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            Agent 요약 (Claude)
          </h2>
          <div className="border border-accent-soft bg-accent-soft/40 rounded p-4 text-sm text-ink whitespace-pre-wrap">
            {event.llm_summary}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
          대응 체크리스트 · 실시간 조치 확인
        </h2>
        <ol className="flex flex-col gap-2">
          {steps.map((step) => (
            <li
              key={step.step_no}
              className="flex items-start gap-3 border border-rule rounded bg-surface p-3"
            >
              <input
                type="checkbox"
                checked={step.is_done}
                disabled={busy === `step-${step.step_no}`}
                onChange={() => toggleStep(step)}
                className="mt-1 h-4 w-4 accent-[var(--accent)]"
              />
              <div className="flex-1">
                <p className={`text-sm ${step.is_done ? "text-ink-faint line-through" : "text-ink"}`}>
                  {step.step_no}. {step.description}
                </p>
                {step.is_done && step.verification_result && (
                  <p className="text-xs text-sev-ok mt-1">✓ {step.verification_result}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
          테스트 검증 · 시스템 원복
        </h2>
        <p className="text-sm text-ink-soft">
          체크리스트 조치가 끝나면 테스트 데이터로 정상 작동 여부를 확인하고,
          샌드박스 데이터를 장애 발생 이전 상태로 복구합니다.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={runVerify}
            disabled={!allStepsDone || busy === "verify"}
            className="rounded border border-rule bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy === "verify" ? "테스트 중…" : "테스트 데이터로 검증"}
          </button>
          <button
            onClick={runRecover}
            disabled={!verifyResult || busy === "recover" || status === "resolved"}
            className="rounded bg-accent text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy === "recover" ? "복구 중…" : "시스템 복구 실행 (샌드박스)"}
          </button>
        </div>

        {verifyResult && (
          <div
            className={`rounded border p-3 text-sm ${
              verifyResult.passed
                ? "border-sev-ok/40 bg-sev-ok-bg text-sev-ok"
                : "border-sev-critical/40 bg-sev-critical-bg text-sev-critical"
            }`}
          >
            {verifyResult.passed ? "✓ 검증 통과" : "✗ 검증 실패"} — {verifyResult.detail}
          </div>
        )}

        {recoverResult && (
          <div
            className={`rounded border p-3 text-sm ${
              recoverResult.result === "success"
                ? "border-sev-ok/40 bg-sev-ok-bg text-sev-ok"
                : "border-sev-critical/40 bg-sev-critical-bg text-sev-critical"
            }`}
          >
            {recoverResult.detail}
          </div>
        )}

        {recoveryActions.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-2">
            {recoveryActions.map((a) => (
              <div key={a.id} className="text-xs text-ink-faint">
                {new Date(a.executed_at).toLocaleTimeString("ko-KR")} · {a.result} · {a.detail}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
