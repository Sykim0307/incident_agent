"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatTile } from "@/components/StatTile";
import LogFilterBar from "@/components/LogFilterBar";
import TopologyDiagram from "@/components/TopologyDiagram";
import IncidentTrendSparkline from "@/components/IncidentTrendSparkline";
import OnCallRoster from "@/components/OnCallRoster";
import SystemHealthBar from "@/components/SystemHealthBar";
import LiveLogTicker from "@/components/LiveLogTicker";
import ResourceMonitor from "@/components/ResourceMonitor";
import IncidentSidebar, { sortEvents, type IncidentSortMode } from "@/components/IncidentSidebar";
import IncidentDetailPanel from "@/components/IncidentDetailPanel";
import { DEFAULT_FILTERS, filterEvents, filterLogs, type LogFilterState } from "@/lib/filters";
import type { AnalyzeResult } from "@/lib/agent/analyze";
import { INCIDENT_LOGS, NORMAL_LOGS, UNKNOWN_PATTERN_LOGS } from "@/lib/agent/scenarios";
import type { IncidentEvent, IncidentKB, OnCallContact, SystemLog } from "@/lib/types";

const ANALYSIS_STAGES = [
  "로그 파싱 및 에러 시그니처 추출 중…",
  "지식베이스와 TF-IDF 유사도 비교 중…",
  "심각도 판정 중…",
  "대응 체크리스트 생성 중…",
];

const SAMPLE_LOGS = [
  { label: "정상 로그 예시", value: NORMAL_LOGS[1].raw_log },
  { label: "장애 로그 예시 (MTS 지연)", value: INCIDENT_LOGS[1].raw_log },
  { label: "미확인 패턴 예시", value: UNKNOWN_PATTERN_LOGS[0].raw_log },
];

const LOG_CAP = 500;
const EVENT_CAP = 300;
const FILTER_STORAGE_KEY = "incident-agent:log-filters";

interface DashboardProps {
  initialLogs: SystemLog[];
  initialEvents: IncidentEvent[];
  knowledgeBase: IncidentKB[];
  onCallContacts: OnCallContact[];
}

export default function Dashboard({
  initialLogs,
  initialEvents,
  knowledgeBase,
  onCallContacts,
}: DashboardProps) {
  const [logs, setLogs] = useState<SystemLog[]>(initialLogs);
  const [events, setEvents] = useState<IncidentEvent[]>(initialEvents);
  const [autoRunning, setAutoRunning] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [testLog, setTestLog] = useState(
    "ERROR [order-svc] Lock wait timeout exceeded; try restarting transaction\nERROR [order-svc] deadlock detected while updating ORD_STATUS table"
  );
  const [testResult, setTestResult] = useState<AnalyzeResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [analyzingStage, setAnalyzingStage] = useState<string | null>(null);
  const [justArrived, setJustArrived] = useState<Set<string>>(new Set());
  const [secondsSinceLastLog, setSecondsSinceLastLog] = useState<number | null>(null);
  const [filters, setFilters] = useState<LogFilterState>(() => {
    if (typeof window === "undefined") return DEFAULT_FILTERS;
    try {
      const stored = sessionStorage.getItem(FILTER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // ignore storage errors (e.g. private mode quota)
    }
  }, [filters]);

  const kbById = useMemo(() => {
    const map = new Map<string, IncidentKB>();
    for (const inc of knowledgeBase) map.set(inc.id, inc);
    return map;
  }, [knowledgeBase]);

  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logsRef = useRef(logs);
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "system_logs" },
        (payload) => {
          const row = payload.new as SystemLog;
          setLogs((prev) => [row, ...prev].slice(0, LOG_CAP));
          setJustArrived((prev) => new Set(prev).add(row.id));
          setTimeout(() => {
            setJustArrived((prev) => {
              const next = new Set(prev);
              next.delete(row.id);
              return next;
            });
          }, 1200);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "incident_events" },
        (payload) => {
          setEvents((prev) => [payload.new as IncidentEvent, ...prev].slice(0, EVENT_CAP));
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

  useEffect(() => {
    const clock = setInterval(() => {
      const latest = logsRef.current[0];
      setSecondsSinceLastLog(
        latest
          ? Math.max(0, Math.floor((Date.now() - new Date(latest.created_at).getTime()) / 1000))
          : null
      );
    }, 1000);
    return () => clearInterval(clock);
  }, []);

  async function runOneTick() {
    setTicking(true);
    try {
      await fetch("/api/demo/tick", { method: "POST" });
    } finally {
      setTicking(false);
    }
  }

  async function handleBulkUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) return;

    setBulkUploading(true);
    setBulkResult(null);
    try {
      const res = await fetch("/api/demo/bulk-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const data = await res.json();
      setBulkResult(
        data.error
          ? data.error
          : `${data.inserted}건 업로드 · 장애 ${data.incidentsDetected}건 감지`
      );
    } catch {
      setBulkResult("업로드 실패");
    } finally {
      setBulkUploading(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    let stageIdx = 0;
    setAnalyzingStage(ANALYSIS_STAGES[0]);
    const stageTimer = setInterval(() => {
      stageIdx = Math.min(stageIdx + 1, ANALYSIS_STAGES.length - 1);
      setAnalyzingStage(ANALYSIS_STAGES[stageIdx]);
    }, 450);
    try {
      const [result] = await Promise.all([
        fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawLog: testLog }),
        }).then((res) => res.json()),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
      setTestResult(result);
    } finally {
      clearInterval(stageTimer);
      setAnalyzingStage(null);
      setTesting(false);
    }
  }

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setTestLog(reader.result);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const availableSystems = useMemo(() => {
    const systems = new Set<string>();
    for (const log of logs) systems.add(log.source_system);
    for (const event of events) if (event.source_system) systems.add(event.source_system);
    return [...systems].sort();
  }, [logs, events]);

  const filteredLogs = useMemo(() => filterLogs(logs, filters), [logs, filters]);
  const filteredEvents = useMemo(
    () => filterEvents(events, filters, kbById),
    [events, filters, kbById]
  );

  const [replayEnabled, setReplayEnabled] = useState(true);
  const [replayId, setReplayId] = useState<string | null>(null);
  const filteredLogsRef = useRef(filteredLogs);
  useEffect(() => {
    filteredLogsRef.current = filteredLogs;
  }, [filteredLogs]);
  const replayCursorRef = useRef(0);

  useEffect(() => {
    if (!replayEnabled) return;
    const interval = setInterval(() => {
      const list = filteredLogsRef.current;
      if (list.length === 0) return;
      replayCursorRef.current = (replayCursorRef.current + 1) % list.length;
      const next = list[replayCursorRef.current];
      setReplayId(next.id);
    }, 2500);
    return () => clearInterval(interval);
  }, [replayEnabled]);

  function selectSystem(system: string) {
    setFilters((prev) =>
      prev.systems.includes(system)
        ? { ...prev, systems: prev.systems.filter((s) => s !== system) }
        : { ...prev, systems: [...prev.systems, system] }
    );
  }

  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const clock = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  const [sortMode, setSortMode] = useState<IncidentSortMode>("severity");
  const [sidebarKeyword, setSidebarKeyword] = useState("");
  const [selectedEventIdRaw, setSelectedEventIdRaw] = useState<string | null>(null);

  const sortedEvents = useMemo(
    () => sortEvents(filteredEvents, sortMode),
    [filteredEvents, sortMode]
  );
  // Derived (not stored) so a stale selection from a resolved/filtered-out
  // incident falls back to the top of the list without needing an effect.
  const selectedEventId =
    selectedEventIdRaw && sortedEvents.some((e) => e.id === selectedEventIdRaw)
      ? selectedEventIdRaw
      : sortedEvents[0]?.id ?? null;

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
            <span className="font-mono text-[11px] uppercase tracking-wider text-accent">
              Monitoring Dashboard
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  autoRunning ? "bg-sev-ok live-dot" : "bg-ink-faint"
                }`}
              />
              <h1 className="text-2xl font-semibold">24/7 장애 관제센터</h1>
            </div>
            <p className="text-sm text-ink-soft mt-1 max-w-xl">
              모의 시스템 로그를 실시간으로 감시하고, 이상 로그가 감지되면 자동으로
              과거 사례를 검색해 대응 체크리스트를 생성합니다. &quot;순환 재생&quot;은
              이미 쌓인 로그를 계속 다시 비춰 화면이 항상 살아있게 보이도록 하며,
              새 로그를 만들지 않아 비용이 들지 않습니다.
            </p>
            {secondsSinceLastLog != null && (
              <p className="text-xs text-ink-faint mt-1 tabular-nums">
                마지막 로그: {secondsSinceLastLog}초 전
              </p>
            )}
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
            <button
              onClick={() => setReplayEnabled((v) => !v)}
              title="이미 저장된 로그를 순서대로 다시 비춰줍니다. 새 데이터 생성이나 추가 비용이 없습니다."
              className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                replayEnabled
                  ? "border border-accent-soft bg-accent-soft text-accent-ink hover:opacity-90"
                  : "border border-rule bg-surface hover:bg-surface-2"
              }`}
            >
              {replayEnabled ? "순환 재생 중 (비용 없음)" : "순환 재생 꺼짐"}
            </button>
            <label
              className={`rounded border border-rule bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2 transition-colors cursor-pointer ${
                bulkUploading ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              {bulkUploading ? "업로드 중…" : "샘플 로그 데이터 업로드"}
              <input
                type="file"
                accept=".log,.txt,.csv"
                onChange={handleBulkUpload}
                disabled={bulkUploading}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {bulkResult && <p className="text-xs text-ink-faint">{bulkResult}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="최근 로그" value={counts.total} />
          <StatTile label="열려있는 장애" value={openEvents.length} />
          <StatTile label="CRITICAL" value={counts.CRITICAL} tone="critical" />
          <StatTile label="HIGH" value={counts.HIGH} tone="high" />
        </div>

        <OnCallRoster contacts={onCallContacts} />
      </section>

      <hr className="border-rule" />

      <LiveLogTicker logs={logs} replayId={replayEnabled ? replayId : null} />

      <SystemHealthBar events={events} />

      <ResourceMonitor />

      <hr className="border-rule" />

      <section className="flex flex-col lg:flex-row gap-6 items-start">
        {/* nowMs starts null and fills in ~1s after mount (see effect above); IncidentSidebar renders immediately and only the relative-time text waits on it. */}
        <IncidentSidebar
          events={sortedEvents}
          kbById={kbById}
          selectedId={selectedEventId}
          onSelect={(e) => setSelectedEventIdRaw(e.id)}
          nowMs={nowMs}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          keyword={sidebarKeyword}
          onKeywordChange={setSidebarKeyword}
        />
        <div className="flex-1 min-w-0 w-full">
          <IncidentDetailPanel eventId={selectedEventId} />
        </div>
      </section>

      <div className="border border-rule rounded bg-surface">
        <p className="p-4 font-mono text-xs uppercase tracking-wide text-ink-faint">
          실시간 로그 스트림 · 검색 필터 · 시스템 구조도 · 추이 · AI 로그 테스트
        </p>
        <div className="border-t border-rule p-4 md:p-6 flex flex-col gap-8">
          <LogFilterBar
            filters={filters}
            onChange={setFilters}
            availableSystems={availableSystems}
            totalLogs={logs.length}
            shownLogs={filteredLogs.length}
            totalEvents={events.length}
            shownEvents={filteredEvents.length}
          />

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-accent live-dot" />
              <div>
                <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
                  실시간 로그 스트림
                </h2>
                <p className="text-xs text-ink-faint mt-0.5">
                  모든 시스템에서 발생하는 로그를 실시간으로 보여줍니다.
                </p>
              </div>
            </div>
            <div
              className="rounded divide-y max-h-[420px] overflow-y-auto font-mono text-xs"
              style={{ background: "#0b0d10", color: "#c9cdd3", borderColor: "#22262c" }}
            >
              {filteredLogs.length === 0 && (
                <p className="p-4" style={{ color: "#71767e" }}>
                  {logs.length === 0
                    ? '아직 로그가 없습니다. "지금 로그 1건 생성"을 눌러보세요.'
                    : "필터 조건에 맞는 로그가 없습니다."}
                </p>
              )}
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 flex gap-3 border-b ${
                    justArrived.has(log.id) || (replayEnabled && replayId === log.id)
                      ? "log-row-in"
                      : ""
                  }`}
                  style={{
                    borderColor: "#1c1f24",
                    background: log.level === "ERROR" ? "rgba(227, 106, 95, 0.14)" : "transparent",
                  }}
                >
                  <span style={{ color: "#71767e" }} className="whitespace-nowrap">
                    {new Date(log.created_at).toLocaleTimeString("ko-KR")}
                  </span>
                  <span
                    className="whitespace-nowrap font-semibold"
                    style={{
                      color:
                        log.level === "ERROR"
                          ? "#e36a5f"
                          : log.level === "WARN"
                            ? "#de9a4a"
                            : "#71767e",
                    }}
                  >
                    [{log.level}]
                  </span>
                  <span style={{ color: "#9aa0a8" }} className="whitespace-nowrap">
                    {log.source_system}
                  </span>
                  <span className="truncate">{log.message}</span>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-rule" />

          <section className="grid lg:grid-cols-2 gap-8">
            <TopologyDiagram
              events={events}
              latestSourceSystem={logs[0]?.source_system ?? null}
              onSelectSystem={selectSystem}
            />
            <IncidentTrendSparkline events={events} />
          </section>

          <hr className="border-rule" />

          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
              AI 로그 자동 분석 (Agent 동작 확인)
            </h2>
            <p className="text-sm text-ink-soft">
              로그를 붙여넣거나 파일을 업로드하면 Agent가 에러 시그니처 추출 → 과거 장애
              사례 유사도 비교 → 심각도 판정 → 체크리스트 생성까지 실제 분석 파이프라인을
              그대로 실행합니다. 샘플 로그로 Agent가 정상 동작하는지 빠르게 확인할 수 있고,
              저장되지 않는 읽기 전용 테스트입니다.
            </p>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-ink-faint">샘플 로그:</span>
              {SAMPLE_LOGS.map((sample) => (
                <button
                  key={sample.label}
                  onClick={() => setTestLog(sample.value)}
                  className="rounded border border-rule bg-surface px-2.5 py-1 text-ink-soft hover:bg-surface-2"
                >
                  {sample.label}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-2 text-ink-faint cursor-pointer">
                로그 파일 업로드
                <input
                  type="file"
                  accept=".log,.txt"
                  onChange={handleFileUpload}
                  className="text-xs max-w-[10rem]"
                />
              </label>
            </div>
            <textarea
              value={testLog}
              onChange={(e) => setTestLog(e.target.value)}
              rows={4}
              className="w-full rounded border border-rule bg-surface p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={runTest}
                disabled={testing}
                className="rounded bg-accent text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {testing ? "AI 분석 중…" : "AI 분석 시작"}
              </button>
              {testing && analyzingStage && (
                <span className="text-xs text-ink-faint flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent live-dot" />
                  {analyzingStage}
                </span>
              )}
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
      </div>
    </div>
  );
}
