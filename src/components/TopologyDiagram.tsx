"use client";

import { computeSystemHealth, SEVERITY_COLOR_VARS } from "@/lib/systemHealth";
import type { IncidentEvent } from "@/lib/types";

interface Node {
  key: string;
  label: string;
  x: number;
  y: number;
}

const NODES: Node[] = [
  { key: "HTS", label: "HTS", x: 12, y: 12 },
  { key: "웹 트레이딩", label: "웹 트레이딩", x: 38, y: 12 },
  { key: "MTS", label: "MTS", x: 64, y: 12 },
  { key: "OpenAPI", label: "OpenAPI", x: 90, y: 12 },
  { key: "RPA", label: "RPA", x: 22, y: 42 },
  { key: "대고객 알림", label: "대고객 알림", x: 78, y: 42 },
  { key: "리포트 배치", label: "리포트 배치", x: 90, y: 68 },
  { key: "계정계", label: "계정계", x: 35, y: 68 },
  { key: "계정계 배치", label: "계정계 배치", x: 62, y: 68 },
  { key: "DB", label: "원장 · 주문 DB (Mock)", x: 50, y: 92 },
];

const EDGES: [string, string][] = [
  ["HTS", "계정계"],
  ["웹 트레이딩", "계정계"],
  ["MTS", "계정계 배치"],
  ["OpenAPI", "계정계"],
  ["RPA", "계정계"],
  ["계정계", "대고객 알림"],
  ["계정계", "DB"],
  ["계정계 배치", "DB"],
  ["리포트 배치", "DB"],
];

interface Props {
  events: IncidentEvent[];
  latestSourceSystem: string | null;
  onSelectSystem?: (system: string) => void;
}

export default function TopologyDiagram({ events, latestSourceSystem, onSelectSystem }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
        시스템 구조도 · 실시간 장애 위치
      </h2>
      <div className="relative border border-rule rounded bg-surface" style={{ height: 340 }}>
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {EDGES.map(([a, b]) => {
            const from = NODES.find((n) => n.key === a);
            const to = NODES.find((n) => n.key === b);
            if (!from || !to) return null;
            return (
              <line
                key={`${a}-${b}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="var(--rule)"
                strokeWidth={0.4}
              />
            );
          })}
        </svg>

        {NODES.map((node) => {
          const health =
            node.key === "DB" ? null : computeSystemHealth(node.key, events);
          const colors = health?.severity ? SEVERITY_COLOR_VARS[health.severity] : null;
          const isLive = node.key === latestSourceSystem;
          const clickable = node.key !== "DB" && Boolean(onSelectSystem);

          return (
            <button
              key={node.key}
              disabled={!clickable}
              onClick={() => clickable && onSelectSystem?.(node.key)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded border px-2 py-1.5 text-[11px] font-medium whitespace-nowrap transition-transform ${
                clickable ? "cursor-pointer hover:scale-105" : "cursor-default"
              } ${isLive ? "node-pulse" : ""}`}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                borderColor: colors?.fg ?? "var(--rule)",
                backgroundColor: colors?.bg ?? "var(--surface-2)",
                color: colors?.fg ?? "var(--ink-soft)",
              }}
              title={
                health?.severity
                  ? `${node.label}: ${health.severity} 장애 ${health.openCount}건`
                  : node.label
              }
            >
              {node.label}
              {health?.severity && (
                <span
                  className="ml-1.5 inline-flex items-center justify-center rounded-full text-[9px] w-4 h-4 leading-none"
                  style={{ backgroundColor: colors?.fg, color: colors?.bg }}
                >
                  {health.openCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-faint">
        색이 있는 노드는 해당 시스템에 열려있는 장애가 있음을 의미합니다. 노드를 클릭하면 아래
        로그/장애 목록이 해당 시스템으로 필터링됩니다.
      </p>
    </div>
  );
}
