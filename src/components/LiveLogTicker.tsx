import type { SystemLog } from "@/lib/types";

const LEVEL_STYLE: Record<string, string> = {
  ERROR: "text-sev-critical",
  WARN: "text-sev-high",
  INFO: "text-ink-faint",
};

export default function LiveLogTicker({
  logs,
  replayId,
}: {
  logs: SystemLog[];
  replayId: string | null;
}) {
  const latest = logs.slice(0, 5);

  return (
    <div className="border border-rule rounded bg-surface px-3 py-2 flex items-center gap-3">
      <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-ink-faint whitespace-nowrap flex-shrink-0">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-sev-ok live-dot" />
        LIVE · 최근 5건
      </span>
      <div className="flex gap-2 flex-1 min-w-0 overflow-x-auto">
        {latest.length === 0 && (
          <span className="text-xs text-ink-faint whitespace-nowrap">로그 대기 중…</span>
        )}
        {latest.map((log) => (
          <span
            key={log.id}
            className={`flex-shrink-0 rounded border border-rule bg-surface-2 px-2 py-1 text-[11px] whitespace-nowrap ${
              replayId === log.id ? "log-row-in" : ""
            }`}
          >
            <span className="text-ink-faint">
              {new Date(log.created_at).toLocaleTimeString("ko-KR")}
            </span>{" "}
            <span className={LEVEL_STYLE[log.level]}>[{log.level}]</span>{" "}
            <span className="text-ink-soft">{log.source_system}</span>{" "}
            <span className="text-ink">{log.message}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
