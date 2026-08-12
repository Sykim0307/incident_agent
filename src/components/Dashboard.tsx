"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { SeverityBadge, StatusBadge } from "@/components/SeverityBadge";
import type { AnalyzeResult } from "@/lib/agent/analyze";
import type { IncidentEvent, IncidentKB, SystemLog } from "@/lib/types";

const LEVEL_STYLE: Record<string, string> = {
  ERROR: "text-sev-critical",
  WARN: "text-sev-high",
  INFO: "text-ink-faint",
};

interface DashboardProps {
  initialLogs: SystemLog[];
  initialEvents: IncidentEvent[];
  knowledgeBase: IncidentKB[];
}

export default function Dashboard({
  initialLogs,
  initialEvents,
  knowledgeBase,
}: DashboardProps) {
  const [logs, setLogs] = useState<SystemLog[]>(initialLogs);
  const [events, setEvents] = useState<IncidentEvent[]>(initialEvents);
  const [autoRunning, setAutoRunning] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [testLog, setTestLog] = useState(
    "ERROR [order-svc] Lock wait timeout exceeded; try restarting transaction\nERROR [order-svc] deadlock detected while updating ORD_STATUS table"
  );
  const [testResult, setTestResult] = useState<AnalyzeResult | null>(null);
  const [testing, setTesting] = useState(false);

  const kbById = useMemo(() => {
    const map = new Map<string, IncidentKB>();
    for (const inc of knowledgeBase) map.set(inc.id, inc);
    return map;
  }, [knowledgeBase]);

  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "system_logs" },
        (payload) => {
          setLogs((prev) => [payload.new as SystemLog, ...prev].slice(0, 40));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "incident_events" },
        (payload) => {
          setEvents((prev) => [payload.new as IncidentEvent, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "incident_events" },
        (payload) => {
          setEvents((prev) =>
            prev.map((e) => (e.id === payload.new.id ? (payload.new as IncidentEvent) : e))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    if (autoRunning) {
      intervalRef.current = setInterval(() => {
        fetch("/api/demo/tick", { method: "POST" }).catch(() => {});
      }, 4000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRunning]);

  async function runOneTick() {
    setTicking(true);
    try {
      await fetch("/api/demo/tick", { method: "POST" });
    } finally {
      setTicking(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawLog: testLog }),
      });
      setTestResult(await res.json());
    } finally {
      setTesting(false);
    }
  }

  const openEvents = events.filter((e) => e.status !== "resolved");
  const counts = {
    CRITICAL: openEvents.filter((e) => e.severity === "CRITICAL").length,
    HIGH: openEvents.filter((e) => e.severity === "HIGH").length,
    total: logs.length,
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">관제 대시보드</h1>
            <p className="text-sm text-ink-soft mt-1 max-w-xl">
              모의 시스템 로그를 실시간으로 감시하고, 이상 로그가 감지되면 자동으로
              과거 사례를 검색해 대응 체크리스트를 생성합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runOneTick}
              disabled={ticking}
              className="rounded border border-rule bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              {ticking ? "생성 중…" : "지금 로그 1건 생성"}
            </button>
            <button
              onClick={() => setAutoRunning((v) => !v)}
              className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                autoRunning
                  ? "bg-accent text-white hover:opacity-90"
                  : "border border-rule bg-surface hover:bg-surface-2"
              }`}
            >
              {autoRunning ? "자동 시뮬레이션 중지" : "자동 시뮬레이션 시작 (4초 간격)"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="최근 로그" value={counts.total} />
          <SummaryCard label="열려있는 장애" value={openEvents.length} />
          <SummaryCard label="CRITICAL" value={counts.CRITICAL} tone="critical" />
          <SummaryCard label="HIGH" value={counts.HIGH} tone="high" />
        </div>
      </section>

      <section className="grid lg:grid-cols-[1.1fr_1fr] gap-8">
        <div className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            실시간 로그 스트림
          </h2>
          <div className="border border-rule rounded bg-surface divide-y divide-rule max-h-[520px] overflow-y-auto">
            {logs.length === 0 && (
              <p className="p-4 text-sm text-ink-faint">
                아직 로그가 없습니다. &quot;지금 로그 1건 생성&quot;을 눌러보세요.
              </p>
            )}
            {logs.map((log) => (
              <div key={log.id} className="p-3 font-mono text-xs flex gap-3">
                <span className="text-ink-faint whitespace-nowrap">
                  {new Date(log.created_at).toLocaleTimeString("ko-KR")}
                </span>
                <span className={`whitespace-nowrap ${LEVEL_STYLE[log.level]}`}>
                  [{log.level}]
                </span>
                <span className="text-ink-faint whitespace-nowrap">{log.source_system}</span>
                <span className="text-ink truncate">{log.message}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            감지된 장애
          </h2>
          <div className="border border-rule rounded bg-surface divide-y divide-rule max-h-[520px] overflow-y-auto">
            {events.length === 0 && (
              <p className="p-4 text-sm text-ink-faint">
                아직 감지된 장애가 없습니다.
              </p>
            )}
            {events.map((event) => {
              const kb = event.matched_incident_id
                ? kbById.get(event.matched_incident_id)
                : null;
              return (
                <Link
                  key={event.id}
                  href={`/incidents/${event.id}`}
                  className="block p-3 hover:bg-surface-2 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={event.severity} />
                    <StatusBadge status={event.status} />
                    <span className="text-xs text-ink-faint ml-auto">
                      {new Date(event.detected_at).toLocaleTimeString("ko-KR")}
                    </span>
                  </div>
                  <p className="text-sm mt-1.5">
                    {kb ? kb.title : "신규 패턴 (지식베이스에 없음)"}
                  </p>
                  {event.similarity_score != null && kb && (
                    <p className="text-xs text-ink-faint mt-0.5">
                      유사도 {(event.similarity_score * 100).toFixed(0)}%
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
          직접 로그 테스트
        </h2>
        <p className="text-sm text-ink-soft">
          아무 로그나 붙여넣고 Agent의 분석 로직(에러 시그니처 추출 + 과거 사례
          유사도 매칭)을 즉석에서 확인해보세요. 저장되지 않는 읽기 전용 테스트입니다.
        </p>
        <textarea
          value={testLog}
          onChange={(e) => setTestLog(e.target.value)}
          rows={4}
          className="w-full rounded border border-rule bg-surface p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <div>
          <button
            onClick={runTest}
            disabled={testing}
            className="rounded bg-accent text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {testing ? "분석 중…" : "분석하기"}
          </button>
        </div>
        {testResult && (
          <div className="border border-rule rounded bg-surface p-4 text-sm flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityBadge severity={testResult.severity} />
              {testResult.matched && (
                <span className="text-ink-soft">
                  {testResult.matched.title} (유사도 {(testResult.score * 100).toFixed(0)}%)
                </span>
              )}
            </div>
            <p className="text-xs text-ink-faint">
              감지된 시그니처:{" "}
              {testResult.detectedSignatures.length > 0
                ? testResult.detectedSignatures.join(", ")
                : "없음"}
            </p>
            <ol className="list-decimal list-inside text-sm flex flex-col gap-1 mt-1">
              {testResult.checklist.map((item, i) => (
                <li key={i} className="text-ink-soft">
                  {item}
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "critical" | "high";
}) {
  const toneClass =
    tone === "critical"
      ? "text-sev-critical"
      : tone === "high"
        ? "text-sev-high"
        : "text-ink";
  return (
    <div className="border border-rule rounded bg-surface px-4 py-3">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className={`text-2xl font-semibold mt-1 tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}
