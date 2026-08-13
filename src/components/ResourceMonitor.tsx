"use client";

import { useEffect, useState } from "react";

interface Metric {
  key: string;
  label: string;
  value: number;
}

const INITIAL: Metric[] = [
  { key: "cpu", label: "CPU 사용률", value: 34 },
  { key: "memory", label: "메모리 사용률", value: 52 },
  { key: "gpu", label: "GPU 사용률", value: 18 },
  { key: "db", label: "DB 스토리지 사용률", value: 61 },
];

function toneFor(value: number) {
  if (value >= 85) return "var(--sev-critical)";
  if (value >= 65) return "var(--sev-high)";
  return "var(--sev-ok)";
}

/**
 * Simulated steady-state infra metrics - the app doesn't have a real
 * server/GPU/DB to poll, so this random-walks plausible values purely for
 * the "평시 모니터링도 가능하다" demo angle. Clearly labeled as mock data.
 */
export default function ResourceMonitor() {
  const [metrics, setMetrics] = useState(INITIAL);

  useEffect(() => {
    const t = setInterval(() => {
      setMetrics((prev) =>
        prev.map((m) => {
          const delta = (Math.random() - 0.5) * 10;
          return { ...m, value: Math.min(97, Math.max(3, m.value + delta)) };
        })
      );
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="border border-rule rounded bg-surface p-3 flex flex-col gap-2">
      <div>
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
          인프라 자원 사용량
        </h2>
        <p className="text-xs text-ink-faint mt-0.5">
          장애 대응뿐 아니라 평시 자원 상태도 함께 모니터링합니다. * 모의 데이터입니다
          (실제 서버 리소스가 아닙니다).
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metrics.map((m) => {
          const color = toneFor(m.value);
          return (
            <div key={m.key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-soft">{m.label}</span>
                <span className="tabular-nums font-medium" style={{ color }}>
                  {Math.round(m.value)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${m.value}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
