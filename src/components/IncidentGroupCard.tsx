import { SeverityBadge } from "@/components/SeverityBadge";
import { formatRelativeTime } from "@/lib/time";
import type { IncidentGroup } from "@/lib/incidentGroups";

interface Props {
  group: IncidentGroup;
  selected: boolean;
  nowMs: number | null;
  onClick: () => void;
}

export default function IncidentGroupCard({ group, selected, nowMs, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded border p-3 flex flex-col gap-1.5 transition-colors ${
        selected
          ? "border-accent bg-accent-soft"
          : "border-rule bg-surface hover:bg-surface-2"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <SeverityBadge severity={group.severity} />
        <span className="text-xs text-ink-faint tabular-nums whitespace-nowrap">
          {group.count}건 발생
        </span>
      </div>
      <p className="text-sm font-medium text-ink line-clamp-2">{group.title}</p>
      <div className="flex items-center gap-1.5 text-xs text-ink-faint">
        <span>최근 {nowMs != null ? formatRelativeTime(group.latestDetectedAt, nowMs) : "…"}</span>
        <span>·</span>
        <span className={group.status === "open" ? "text-accent-ink" : "text-sev-ok"}>
          {group.status === "open" ? "진행중" : "해결됨"}
        </span>
      </div>
    </button>
  );
}
