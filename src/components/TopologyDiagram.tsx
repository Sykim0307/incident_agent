"use client";

import SeverityLegend from "@/components/SeverityLegend";
import { computeSystemHealth, SEVERITY_COLOR_VARS } from "@/lib/systemHealth";
import type { IncidentEvent } from "@/lib/types";

interface Node {
  key: string;
  label: string;
  x: number;
  y: number;
}

// 계층형 레이아웃: 상단(클라이언트/채널) -> 중단(비즈니스 로직/코어) -> 하단(DB)
const NODES: Node[] = [
  // 상단 - 클라이언트/채널
  { key: "HTS", label: "HTS", x: 8, y: 14 },
  { key: "웹 트레이딩", label: "웹 트레이딩", x: 27, y: 14 },
  { key: "MTS", label: "MTS", x: 50, y: 14 },
  { key: "OpenAPI", label: "OpenAPI", x: 73, y: 14 },
  { key: "대고객 알림", label: "대고객 알림", x: 92, y: 14 },
  // 중단 - 비즈니스 로직/코어
  { key: "계정계", label: "계정계", x: 12, y: 54 },
  { key: "계정계 배치", label: "계정계 배치", x: 38, y: 54 },
  { key: "리포트 배치", label: "리포트 배치", x: 62, y: 54 },
  { key: "RPA", label: "RPA", x: 88, y: 54 },
  // 하단 - 데이터베이스
  { key: "DB", label: "원장 · 주문 DB (Mock)", x: 50, y: 90 },
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

function curvedPath(from: Node, to: Node): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  // perpendicular offset so edges arc instead of overlapping straight lines
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const curve = Math.min(6, len * 0.15);
  const cx = mx + (-dy / len) * curve;
  const cy = my + (dx / len) * curve;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

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
      <div className="relative border border-rule rounded bg-surface" style={{ height: 380 }}>
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <marker
              id="topology-arrow"
              markerWidth="6"
              markerHeight="6"
              refX="4.5"
              refY="3"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="var(--ink-faint)" />
            </marker>
          </defs>
          {EDGES.map(([a, b]) => {
            const from = NODES.find((n) => n.key === a);
            const to = NODES.find((n) => n.key === b);
            if (!from || !to) return null;
            return (
              <path
                key={`${a}-${b}`}
                d={curvedPath(from, to)}
                fill="none"
                stroke="var(--ink-faint)"
                strokeWidth={0.4}
                markerEnd="url(#topology-arrow)"
              />
            );
          })}
        </svg>

        {NODES.map((node) => {
          const health =
            node.key === "DB" ? null : computeSystemHealth(node.key, events);
          const colors = health?.severity ? SEVERITY_COLOR_VARS[health.severity] : null;
          const isLive = node.key === latestSourceSystem;
          const isUrgent = health?.severity === "CRITICAL" || health?.severity === "HIGH";
          const clickable = node.key !== "DB" && Boolean(onSelectSystem);

          return (
            <button
              key={node.key}
              disabled={!clickable}
              onClick={() => clickable && onSelectSystem?.(node.key)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded border px-2 py-1.5 text-[11px] font-medium whitespace-nowrap transition-transform ${
                clickable ? "cursor-pointer hover:scale-105" : "cursor-default"
              } ${isUrgent || isLive ? "node-pulse" : ""}`}
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
        화살표는 시스템 간 데이터 흐름 방향을 나타냅니다. 노드 색은 열려있는 장애의
        위험도를 의미하며, CRITICAL·HIGH 등급 노드는 계속 깜빡여 즉시 확인이 필요함을
        알립니다. 노드를 클릭하면 아래 로그/장애 목록이 해당 시스템으로 필터링됩니다.
      </p>
      <SeverityLegend />
    </div>
  );
}
