import { SEVERITY_COLOR_VARS } from "@/lib/systemHealth";

const ENTRIES: { key: string; label: string; desc: string }[] = [
  { key: "CRITICAL", label: "CRITICAL (빨강)", desc: "즉시 조치 필요" },
  { key: "HIGH", label: "HIGH (주황/노랑)", desc: "긴급 대응 필요" },
  { key: "MEDIUM", label: "MEDIUM (파랑)", desc: "확인 및 대응 필요" },
  { key: "LOW", label: "LOW (초록)", desc: "경미함 · 정상 범위" },
  { key: "UNKNOWN", label: "UNKNOWN (회색)", desc: "신규 패턴 · 에스컬레이션" },
];

export default function SeverityLegend() {
  return (
    <div className="flex items-center gap-4 flex-wrap text-[11px] text-ink-faint">
      {ENTRIES.map((e) => {
        const colors = SEVERITY_COLOR_VARS[e.key];
        return (
          <span key={e.key} className="flex items-center gap-1.5" title={e.desc}>
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: colors.fg }}
            />
            <span>
              {e.label} · {e.desc}
            </span>
          </span>
        );
      })}
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-surface-2 border border-rule flex-shrink-0" />
        <span>정상 (열려있는 장애 없음)</span>
      </span>
    </div>
  );
}
