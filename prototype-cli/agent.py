"""
Incident Response Copilot
--------------------------
시스템 개발 및 운영 직군을 위한 장애 대응 지원 Agent.

입력: 장애 발생 시 수집된 로그/증상 텍스트
동작:
  1) 로그에서 에러 시그니처(예외명, HTTP 코드, 타임아웃 등) 추출
  2) 과거 장애 사례 DB에서 유사 사례를 TF-IDF 코사인 유사도로 검색
  3) 원인 추정 + 대응 체크리스트 제안
  4) 담당자 공유용 장애 보고 초안 생성

외부 API 의존성 없이 순수 Python 표준 라이브러리만으로 동작하며,
ANTHROPIC_API_KEY 환경변수가 설정되어 있으면 보고서 문장을 LLM으로
한 번 더 다듬어주는 선택적 기능을 제공한다(없어도 전체 기능 동작).
"""

from __future__ import annotations

import json
import math
import os
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

DATA_PATH = Path(__file__).parent / "data" / "incidents.json"

# 로그에서 눈에 띄는 에러 시그니처를 뽑아내기 위한 패턴들
ERROR_SIGNATURE_PATTERNS = [
    r"[A-Za-z.]+(?:Exception|Error)\b",
    r"\b[45]\d{2}\b(?=\s|$|[^\d])",
    r"\bTimeout\b|\btimed out\b|\btimeout\b",
    r"\bLock wait\b|\bdeadlock\b",
    r"\bconnection pool\b|\bconnection refused\b",
    r"\brate limit\b",
    r"\bconsumer lag\b|\bmessage queue\b|\bMQ\b",
]


def tokenize(text: str) -> list[str]:
    text = text.lower()
    # 한글/영문/숫자 토큰 추출 (기호는 구분자로 취급)
    return re.findall(r"[a-z0-9가-힣]+", text)


@dataclass
class Incident:
    id: str
    title: str
    system: str
    keywords: list[str]
    symptoms: str
    root_cause: str
    resolution: list[str]
    severity: str
    avg_resolution_min: int
    _tokens: list[str] = field(default_factory=list, repr=False)

    def corpus_text(self) -> str:
        return " ".join([self.title, self.system, self.symptoms, " ".join(self.keywords)])


class IncidentKnowledgeBase:
    def __init__(self, incidents: list[Incident]):
        self.incidents = incidents
        for inc in self.incidents:
            inc._tokens = tokenize(inc.corpus_text())
        self._idf = self._compute_idf()

    @classmethod
    def load(cls, path: Path = DATA_PATH) -> "IncidentKnowledgeBase":
        raw = json.loads(path.read_text(encoding="utf-8"))
        incidents = [Incident(**item) for item in raw]
        return cls(incidents)

    def _compute_idf(self) -> dict[str, float]:
        n = len(self.incidents)
        df: Counter[str] = Counter()
        for inc in self.incidents:
            for term in set(inc._tokens):
                df[term] += 1
        return {term: math.log((n + 1) / (freq + 1)) + 1 for term, freq in df.items()}

    def _tfidf_vector(self, tokens: list[str]) -> dict[str, float]:
        tf = Counter(tokens)
        vec = {}
        for term, count in tf.items():
            idf = self._idf.get(term, math.log(len(self.incidents) + 1) + 1)
            vec[term] = count * idf
        return vec

    @staticmethod
    def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
        common = set(a) & set(b)
        num = sum(a[t] * b[t] for t in common)
        norm_a = math.sqrt(sum(v * v for v in a.values()))
        norm_b = math.sqrt(sum(v * v for v in b.values()))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return num / (norm_a * norm_b)

    def search(self, query_text: str, top_k: int = 3) -> list[tuple[Incident, float]]:
        query_tokens = tokenize(query_text)
        query_vec = self._tfidf_vector(query_tokens)
        scored = []
        for inc in self.incidents:
            inc_vec = self._tfidf_vector(inc._tokens)
            score = self._cosine(query_vec, inc_vec)
            scored.append((inc, score))
        scored.sort(key=lambda pair: pair[1], reverse=True)
        return scored[:top_k]


def extract_error_signatures(log_text: str) -> list[str]:
    found: list[str] = []
    for pattern in ERROR_SIGNATURE_PATTERNS:
        for match in re.finditer(pattern, log_text, flags=re.IGNORECASE):
            token = match.group(0).strip()
            if token and token not in found:
                found.append(token)
    return found


MATCH_THRESHOLD = 0.12  # 이 아래 유사도는 "유사 사례 없음"으로 처리


@dataclass
class AgentReport:
    detected_signatures: list[str]
    matches: list[tuple[Incident, float]]
    best_match: Incident | None
    best_score: float
    recommended_severity: str
    checklist: list[str]
    draft_alert: str


class IncidentResponseAgent:
    def __init__(self, kb: IncidentKnowledgeBase | None = None):
        self.kb = kb or IncidentKnowledgeBase.load()

    def analyze(self, log_text: str, system_hint: str = "") -> AgentReport:
        signatures = extract_error_signatures(log_text)
        matches = self.kb.search(f"{system_hint} {log_text}", top_k=3)
        best_match, best_score = matches[0] if matches else (None, 0.0)

        if best_match is None or best_score < MATCH_THRESHOLD:
            severity = "UNKNOWN - 수동 분류 필요"
            checklist = [
                "유사 과거 사례가 발견되지 않았습니다. 신규 장애 패턴일 수 있습니다.",
                "당직 시니어 엔지니어에게 즉시 에스컬레이션하세요.",
                "해결 후 본 사례를 지식베이스(incidents.json)에 등록해 다음 대응 속도를 높이세요.",
            ]
            best_match_for_report = None
        else:
            severity = best_match.severity
            checklist = list(best_match.resolution)
            best_match_for_report = best_match

        draft_alert = self._draft_alert(signatures, best_match_for_report, best_score, severity)

        return AgentReport(
            detected_signatures=signatures,
            matches=matches,
            best_match=best_match_for_report,
            best_score=best_score,
            recommended_severity=severity,
            checklist=checklist,
            draft_alert=draft_alert,
        )

    @staticmethod
    def _draft_alert(signatures, matched: Incident | None, score: float, severity: str) -> str:
        now = datetime.now().strftime("%Y-%m-%d %H:%M")
        lines = [
            f"[장애 감지 알림] {now}",
            f"심각도: {severity}",
            f"감지된 에러 시그니처: {', '.join(signatures) if signatures else '없음'}",
        ]
        if matched:
            lines.append(f"유사 과거 사례: {matched.id} - {matched.title} (유사도 {score:.0%})")
            lines.append(f"추정 원인: {matched.root_cause}")
            lines.append("1차 대응은 아래 체크리스트를 참고해 주세요. (Agent 자동 생성 초안, 검토 후 발송)")
        else:
            lines.append("유사 과거 사례 없음 - 신규 패턴 가능성, 시니어 엔지니어 에스컬레이션 요망")
        return "\n".join(lines)

    def maybe_llm_refine(self, report: AgentReport) -> str | None:
        """ANTHROPIC_API_KEY가 있을 때만 자연어 보고서를 한 번 더 다듬어 반환. 없으면 None."""
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            return None
        try:
            import anthropic
        except ImportError:
            return None

        client = anthropic.Anthropic(api_key=api_key)
        prompt = (
            "다음은 자동화 Agent가 만든 장애 대응 초안입니다. "
            "증권사 IT 운영팀 신입/주니어 엔지니어가 바로 이해하고 실행할 수 있도록 "
            "간결한 한국어 장애 보고서로 다듬어 주세요.\n\n"
            f"{report.draft_alert}\n\n체크리스트:\n"
            + "\n".join(f"- {item}" for item in report.checklist)
        )
        message = client.messages.create(
            model="claude-sonnet-5",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text
