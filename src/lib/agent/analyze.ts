import type { SupabaseClient } from "@supabase/supabase-js";
import { extractErrorSignatures } from "@/lib/agent/signatures";
import { searchSimilarIncidents, MATCH_THRESHOLD } from "@/lib/agent/similarity";
import type { IncidentKB } from "@/lib/types";

const ESCALATION_CHECKLIST = [
  "유사 과거 사례가 발견되지 않았습니다. 신규 장애 패턴일 수 있습니다.",
  "당직 시니어 엔지니어에게 즉시 에스컬레이션하세요.",
  "해결 후 본 사례를 지식베이스(incidents_kb)에 등록해 다음 대응 속도를 높이세요.",
];

export interface AnalyzeResult {
  detectedSignatures: string[];
  matched: IncidentKB | null;
  score: number;
  severity: string;
  checklist: string[];
}

/**
 * Read-only version of the tick pipeline's matching step - analyzes arbitrary
 * pasted log text against the knowledge base without writing anything.
 * Powers the "직접 로그 테스트" box on the dashboard.
 */
export async function analyzeRawLog(
  supabase: SupabaseClient,
  rawLog: string,
  sourceSystem = ""
): Promise<AnalyzeResult> {
  const signatures = extractErrorSignatures(rawLog);

  const { data: kb } = await supabase.from("incidents_kb").select("*");
  const knowledgeBase = (kb ?? []) as IncidentKB[];

  const matches = searchSimilarIncidents(`${sourceSystem} ${rawLog}`, knowledgeBase, 1);
  const best = matches[0];
  const isMatch = best && best.score >= MATCH_THRESHOLD;

  return {
    detectedSignatures: signatures,
    matched: isMatch ? best.incident : null,
    score: best ? best.score : 0,
    severity: isMatch ? best.incident.severity : "UNKNOWN",
    checklist: isMatch ? best.incident.resolution : ESCALATION_CHECKLIST,
  };
}
