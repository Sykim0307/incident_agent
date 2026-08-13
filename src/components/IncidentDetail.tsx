"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SeverityBadge, StatusBadge } from "@/components/SeverityBadge";
import { StatTile } from "@/components/StatTile";
import IncidentImpact from "@/components/IncidentImpact";
import NotificationPanel from "@/components/NotificationPanel";
import { formatDuration } from "@/lib/time";
import type {
  ChecklistStep,
  IncidentEvent,
  IncidentKB,
  LedgerAccount,
  MtsOrder,
  NotificationRecord,
  RecoveryAction,
  SystemLog,
} from "@/lib/types";

interface SnapshotOrder {
  id: string;
  account_id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  status: string;
}

interface Props {
  event: IncidentEvent;
  steps: ChecklistStep[];
  sourceLog: SystemLog | null;
  matched: IncidentKB | null;
  recoveryActions: RecoveryAction[];
  snapshotOrders: SnapshotOrder[];
  accounts: LedgerAccount[];
  currentOrders: MtsOrder[];
  notifications: (NotificationRecord & { on_call_contacts: { name: string; role: string } | null })[];
  hideBackLink?: boolean;
}

export default function IncidentDetail({
  event,
  steps: initialSteps,
  sourceLog,
  matched,
  recoveryActions: initialActions,
  snapshotOrders,
  accounts,
  currentOrders,
  notifications,
  hideBackLink,
}: Props) {
  const [steps, setSteps] = useState(initialSteps);
  const [status, setStatus] = useState(event.status);
  const [resolvedAt, setResolvedAt] = useState(event.resolved_at);
  const [resolutionMethod, setResolutionMethod] = useState(event.resolution_method);
  const [resolutionNote, setResolutionNote] = useState(event.resolution_note);
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

  const [autoConfirming, setAutoConfirming] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoLog, setAutoLog] = useState<string[]>([]);
  const [showManualChecklist, setShowManualChecklist] = useState(false);

  const [completeConfirming, setCompleteConfirming] = useState(false);
  const [completeNote, setCompleteNote] = useState("");
  const [completing, setCompleting] = useState(false);

  const [report, setReport] = useState(event.draft_report);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportCopied, setReportCopied] = useState(false);

  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const allStepsDone = steps.length > 0 && steps.every((s) => s.is_done);
  const isResolved = status === "resolved";

  const affectedUsers = new Set(snapshotOrders.map((o) => o.account_id)).size;
  const confidencePct =
    event.similarity_score != null ? Math.round(event.similarity_score * 100) : null;
  const durationMs =
    nowMs != null
      ? (resolvedAt ? new Date(resolvedAt).getTime() : nowMs) -
        new Date(event.detected_at).getTime()
      : null;
  const nextAction = steps.find((s) => !s.is_done);
  const checklistVisible =
    showManualChecklist ||
    autoBusy ||
    autoConfirming ||
    isResolved ||
    steps.some((s) => s.is_done);

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

  async function callVerify() {
    const res = await fetch(`/api/incidents/${event.id}/verify`, { method: "POST" });
    const data = await res.json();
    setVerifyResult(data);
    return data as { passed: boolean; detail: string };
  }

  async function callRecover() {
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
    if (data.result === "success") {
      setStatus("resolved");
      setResolvedAt(new Date().toISOString());
      setResolutionMethod("recovery");
    }
    return data as { result: string; detail: string };
  }

  async function runVerify() {
    setBusy("verify");
    setVerifyResult(null);
    try {
      await callVerify();
    } finally {
      setBusy(null);
    }
  }

  async function runRecover() {
    setBusy("recover");
    setRecoverResult(null);
    try {
      await callRecover();
    } finally {
      setBusy(null);
    }
  }

  async function runAutoExecute() {
    setAutoConfirming(false);
    setAutoBusy(true);
    setAutoLog([]);
    const log = (line: string) => setAutoLog((prev) => [...prev, line]);

    try {
      const pending = steps.filter((s) => !s.is_done);
      for (const step of pending) {
        log(`체크리스트 ${step.step_no}번 실행 중… ${step.description}`);
        const res = await fetch(`/api/incidents/${event.id}/checklist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step_no: step.step_no, is_done: true }),
        });
        const { step: updated } = await res.json();
        setSteps((prev) => prev.map((s) => (s.step_no === step.step_no ? updated : s)));
        setStatus("in_progress");
        log(`✓ ${step.step_no}번 완료 확인됨`);
        await new Promise((r) => setTimeout(r, 500));
      }
      setStatus("verifying");

      log("테스트 데이터로 검증 실행 중…");
      let verify = await callVerify();
      log(verify.passed ? `✓ 검증 통과 — ${verify.detail}` : `✗ 검증 실패 — ${verify.detail}`);
      await new Promise((r) => setTimeout(r, 400));

      log("시스템 복구 실행 중…");
      const recover = await callRecover();
      log(`${recover.result === "success" ? "✓" : "✗"} 복구 결과 — ${recover.detail}`);

      if (!verify.passed) {
        await new Promise((r) => setTimeout(r, 400));
        log("복구 후 재검증 중…");
        verify = await callVerify();
        log(verify.passed ? "✓ 재검증 통과" : `✗ 재검증 실패 — ${verify.detail}`);
      }

      log("자동 실행이 종료되었습니다.");
    } finally {
      setAutoBusy(false);
    }
  }

  async function runComplete() {
    setCompleting(true);
    try {
      const res = await fetch(`/api/incidents/${event.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: completeNote }),
      });
      const { event: updated } = await res.json();
      setStatus(updated.status);
      setResolvedAt(updated.resolved_at);
      setResolutionMethod(updated.resolution_method);
      setResolutionNote(updated.resolution_note);
      setCompleteConfirming(false);
    } finally {
      setCompleting(false);
    }
  }

  async function runGenerateReport() {
    setReportGenerating(true);
    setReportCopied(false);
    try {
      const res = await fetch(`/api/incidents/${event.id}/report`, { method: "POST" });
      const data = await res.json();
      setReport(data.report ?? null);
    } finally {
      setReportGenerating(false);
    }
  }

  async function copyReport() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 1500);
    } catch {
      // clipboard API unavailable — ignore, report text is still visible to select/copy manually
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 flex flex-col gap-8">
      <div>
        {!hideBackLink && (
          <Link href="/" className="text-xs text-ink-faint hover:text-ink">
            ← 대시보드로
          </Link>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <SeverityBadge severity={event.severity} />
          <StatusBadge status={status} />
          {event.source_system && (
            <span className="text-xs text-ink-faint">{event.source_system}</span>
          )}
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
        {isResolved && resolvedAt && (
          <p className="text-xs text-sev-ok mt-1">
            {resolutionMethod === "manual" ? "수동으로 완료 처리됨" : "자동 복구로 해결됨"} ·{" "}
            {new Date(resolvedAt).toLocaleString("ko-KR")}
            {resolutionNote ? ` · ${resolutionNote}` : ""}
          </p>
        )}
      </div>

      <section className="grid sm:grid-cols-3 gap-3">
        <StatTile
          label="영향 사용자"
          value={affectedUsers > 0 ? affectedUsers.toLocaleString("ko-KR") : "-"}
        />
        <StatTile
          label="근본원인 신뢰도"
          value={confidencePct != null ? `${confidencePct}%` : "-"}
        />
        <StatTile label="지속 시간" value={durationMs != null ? formatDuration(durationMs) : "-"} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">Evidence</h2>
        <div className="flex flex-wrap gap-1.5">
          {event.detected_signatures.length > 0 ? (
            event.detected_signatures.map((sig, i) => (
              <span
                key={i}
                className="rounded-full border border-rule bg-surface-2 px-2.5 py-1 text-xs text-ink-soft"
              >
                {sig}
              </span>
            ))
          ) : (
            <span className="text-xs text-ink-faint">감지된 시그니처 없음</span>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
          Next Best Action
        </h2>
        {nextAction ? (
          <div className="flex items-center gap-2 text-sm border border-rule rounded bg-surface p-3">
            <SeverityBadge severity={event.severity} />
            <span className="text-ink">{nextAction.description}</span>
          </div>
        ) : (
          <p className="text-sm text-ink-faint">
            {steps.length === 0 ? "체크리스트가 없습니다." : "모든 조치가 완료되었습니다."}
          </p>
        )}
      </section>

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

      <IncidentImpact
        snapshotOrders={snapshotOrders}
        accounts={accounts}
        currentOrders={currentOrders}
      />

      <NotificationPanel incidentEventId={event.id} initialNotifications={notifications} />

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

      {!isResolved && (
        <section className="flex flex-col gap-3 border border-accent-soft bg-accent-soft/30 rounded p-4">
          <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            권장 조치 자동 실행
          </h2>
          <p className="text-sm text-ink-soft">
            아래 체크리스트 → 테스트 검증 → 시스템 복구를 사용자 승인 하에 순서대로 자동
            실행합니다. 한 단계씩 실행되는 과정을 실시간으로 보여드립니다.
          </p>
          {!autoConfirming && !autoBusy && (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setAutoConfirming(true)}
                className="rounded bg-accent text-white px-4 py-2 text-sm font-medium hover:opacity-90"
              >
                체크리스트 → 검증 → 복구 자동 실행
              </button>
              {!checklistVisible && (
                <button
                  onClick={() => setShowManualChecklist(true)}
                  className="text-xs text-ink-faint underline hover:text-ink"
                >
                  수동으로 체크리스트 보기
                </button>
              )}
            </div>
          )}
          {autoConfirming && !autoBusy && (
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="text-ink">
                남은 조치 {steps.filter((s) => !s.is_done).length}건을 포함해 자동으로
                실행합니다. 계속하시겠습니까?
              </span>
              <button
                onClick={runAutoExecute}
                className="rounded bg-accent text-white px-3 py-1.5 text-xs font-medium hover:opacity-90"
              >
                승인 및 실행
              </button>
              <button
                onClick={() => setAutoConfirming(false)}
                className="rounded border border-rule px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
              >
                취소
              </button>
            </div>
          )}
          {autoLog.length > 0 && (
            <div className="border border-rule rounded bg-surface p-3 font-mono text-xs flex flex-col gap-1 max-h-56 overflow-y-auto">
              {autoLog.map((line, i) => (
                <p key={i} className="text-ink-soft">
                  {line}
                </p>
              ))}
            </div>
          )}
        </section>
      )}

      {checklistVisible && (
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
                  disabled={busy === `step-${step.step_no}` || autoBusy}
                  onChange={() => toggleStep(step)}
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                />
                <div className="flex-1">
                  <p
                    className={`text-sm ${step.is_done ? "text-ink-faint line-through" : "text-ink"}`}
                  >
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
      )}

      {checklistVisible && (
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
              disabled={!allStepsDone || busy === "verify" || autoBusy}
              className="rounded border border-rule bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy === "verify" ? "테스트 중…" : "테스트 데이터로 검증"}
            </button>
            <button
              onClick={runRecover}
              disabled={!verifyResult || busy === "recover" || isResolved || autoBusy}
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

          {isResolved && recoveryActions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mt-2 pt-3 border-t border-rule">
              <span className="text-xs text-ink-faint">조치 완료 후에도 필요하다면:</span>
              <button
                onClick={runVerify}
                disabled={busy === "verify"}
                className="rounded border border-rule bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
              >
                {busy === "verify" ? "검증 중…" : "다시 검증하기"}
              </button>
              <button
                onClick={runRecover}
                disabled={busy === "recover"}
                className="rounded border border-rule bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
              >
                {busy === "recover" ? "되돌리는 중…" : "이전 상태로 되돌리기"}
              </button>
            </div>
          )}
        </section>
      )}

      {!isResolved && (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            장애 조치 완료
          </h2>
          <p className="text-sm text-ink-soft">
            복구 대상이 없거나 이미 조치가 끝났다면, 여기서 명시적으로 장애 대응을 완료
            처리할 수 있습니다.
          </p>
          {!completeConfirming ? (
            <div>
              <button
                onClick={() => setCompleteConfirming(true)}
                disabled={completing}
                className="rounded border border-rule bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2"
              >
                장애 조치 완료 처리
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <textarea
                value={completeNote}
                onChange={(e) => setCompleteNote(e.target.value)}
                placeholder="완료 처리 메모 (선택)"
                rows={2}
                className="w-full rounded border border-rule bg-surface p-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <div className="flex gap-2">
                <button
                  onClick={runComplete}
                  disabled={completing}
                  className="rounded bg-accent text-white px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {completing ? "처리 중…" : "완료 확정"}
                </button>
                <button
                  onClick={() => setCompleteConfirming(false)}
                  disabled={completing}
                  className="rounded border border-rule px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            장애조치 보고서
          </h2>
          <div className="flex gap-2">
            {report && (
              <button
                onClick={copyReport}
                className="rounded border border-rule bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
              >
                {reportCopied ? "복사됨" : "복사"}
              </button>
            )}
            <button
              onClick={runGenerateReport}
              disabled={reportGenerating}
              className="rounded bg-accent text-white px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              {reportGenerating ? "생성 중…" : report ? "보고서 새로고침" : "보고서 생성"}
            </button>
          </div>
        </div>
        {report ? (
          <pre className="border border-rule rounded bg-surface p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto">
            {report}
          </pre>
        ) : (
          <p className="text-sm text-ink-faint">
            현재까지의 감지·조치·검증·복구·알림 내역을 바탕으로 보고서를 생성할 수 있습니다.
          </p>
        )}
      </section>
    </div>
  );
}
