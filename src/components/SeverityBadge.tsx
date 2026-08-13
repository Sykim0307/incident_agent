const STYLES: Record<string, string> = {
  CRITICAL: "bg-sev-critical-bg text-sev-critical",
  HIGH: "bg-sev-high-bg text-sev-high",
  MEDIUM: "bg-sev-medium-bg text-sev-medium",
  LOW: "bg-sev-low-bg text-sev-low",
  UNKNOWN: "bg-sev-unknown-bg text-sev-unknown",
};

export function SeverityBadge({ severity }: { severity: string }) {
  const style = STYLES[severity] ?? STYLES.UNKNOWN;
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-wide ${style}`}
    >
      {severity}
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  open: "신규 감지",
  in_progress: "조치 중",
  verifying: "검증 대기",
  resolved: "해결됨",
  escalated: "에스컬레이션",
};

export function StatusBadge({ status }: { status: string }) {
  const isResolved = status === "resolved";
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${
        isResolved
          ? "bg-sev-ok-bg text-sev-ok"
          : "bg-accent-soft text-accent-ink"
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
