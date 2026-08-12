import type { IncidentKB } from "@/lib/types";

export const MATCH_THRESHOLD = 0.12;

function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9가-힣]+/g);
  return matches ?? [];
}

function corpusText(inc: IncidentKB): string {
  return [inc.title, inc.system_name, inc.symptoms, ...inc.keywords].join(" ");
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

function computeIdf(tokenLists: string[][]): Map<string, number> {
  const n = tokenLists.length;
  const df = new Map<string, number>();
  for (const tokens of tokenLists) {
    for (const term of new Set(tokens)) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [term, freq] of df) {
    idf.set(term, Math.log((n + 1) / (freq + 1)) + 1);
  }
  return idf;
}

function tfidfVector(
  tokens: string[],
  idf: Map<string, number>,
  fallbackIdf: number
): Map<string, number> {
  const tf = termFrequency(tokens);
  const vec = new Map<string, number>();
  for (const [term, count] of tf) {
    vec.set(term, count * (idf.get(term) ?? fallbackIdf));
  }
  return vec;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [term, va] of a) {
    const vb = b.get(term);
    if (vb) dot += va * vb;
  }
  const normA = Math.sqrt([...a.values()].reduce((s, v) => s + v * v, 0));
  const normB = Math.sqrt([...b.values()].reduce((s, v) => s + v * v, 0));
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

export interface MatchResult {
  incident: IncidentKB;
  score: number;
}

/**
 * Ports agent.py's IncidentKnowledgeBase.search() to TypeScript.
 * Recomputed per request; fine at the current knowledge-base scale (dozens of rows).
 */
export function searchSimilarIncidents(
  queryText: string,
  knowledgeBase: IncidentKB[],
  topK = 3
): MatchResult[] {
  const kbTokenLists = knowledgeBase.map((inc) => tokenize(corpusText(inc)));
  const idf = computeIdf(kbTokenLists);
  const fallbackIdf = Math.log(knowledgeBase.length + 1) + 1;

  const queryVec = tfidfVector(tokenize(queryText), idf, fallbackIdf);

  const scored: MatchResult[] = knowledgeBase.map((incident, i) => ({
    incident,
    score: cosine(queryVec, tfidfVector(kbTokenLists[i], idf, fallbackIdf)),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
