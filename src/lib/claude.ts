import Anthropic from "@anthropic-ai/sdk";
import type { IncidentKB } from "@/lib/types";

export interface NarrativeInput {
  detectedSignatures: string[];
  severity: string;
  matchedIncident: IncidentKB | null;
  similarityScore: number;
  checklist: string[];
}

/**
 * Generates a natural-language incident report from the agent's structured output.
 * Returns null (never throws) when ANTHROPIC_API_KEY is not configured, so the
 * rest of the pipeline keeps working without the LLM step.
 */
export async function refineIncidentNarrative(
  input: NarrativeInput
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const kbSection = input.matchedIncident
    ? `유사 과거 사례: ${input.matchedIncident.id} - ${input.matchedIncident.title} (유사도 ${(input.similarityScore * 100).toFixed(0)}%)\n추정 원인: ${input.matchedIncident.root_cause}`
    : "유사 과거 사례 없음 (신규 장애 패턴 가능성)";

  const prompt = `당신은 증권사 IT 운영팀의 장애 대응을 돕는 어시스턴트입니다.
아래는 자동 분석 Agent가 만든 구조화된 장애 정보입니다. 이를 바탕으로
신입/주니어 엔지니어가 3~5문장 안에서 바로 이해할 수 있는 간결한 한국어
장애 상황 요약을 작성하세요. 과장하지 말고, 사실만 근거로 설명하세요.

감지된 에러 시그니처: ${input.detectedSignatures.join(", ") || "없음"}
추정 심각도: ${input.severity}
${kbSection}
1차 대응 체크리스트:
${input.checklist.map((c, i) => `${i + 1}. ${c}`).join("\n")}`;

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : null;
}
