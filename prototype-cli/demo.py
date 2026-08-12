"""
발표용 데모 실행 스크립트.

사용법:
  python demo.py                # 샘플 로그 목록에서 선택해 실행 (대화형)
  python demo.py --all          # 모든 샘플 로그를 순서대로 실행
  python demo.py --file <path>  # 임의의 로그 파일을 분석
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

if sys.platform == "win32":
    # Windows 콘솔 기본 코드페이지(cp949)로 인한 한글 깨짐 방지
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from agent import IncidentResponseAgent

SAMPLE_DIR = Path(__file__).parent / "sample_logs"
LINE = "=" * 72


def print_report(log_name: str, log_text: str, agent: IncidentResponseAgent) -> None:
    report = agent.analyze(log_text)

    print(LINE)
    print(f"[입력 로그] {log_name}")
    print("-" * 72)
    print(log_text.strip())
    print(LINE)
    print("Incident Response Copilot 분석 결과")
    print("-" * 72)
    print(f"감지된 에러 시그니처 : {', '.join(report.detected_signatures) or '없음'}")
    print(f"추정 심각도          : {report.recommended_severity}")

    if report.best_match:
        print(f"유사 과거 사례       : {report.best_match.id} - {report.best_match.title}")
        print(f"유사도               : {report.best_score:.0%}")
        print(f"추정 원인            : {report.best_match.root_cause}")
    else:
        print("유사 과거 사례       : 없음 (신규 장애 패턴 가능성)")

    print("\n[대응 체크리스트]")
    for i, item in enumerate(report.checklist, 1):
        print(f"  {i}. {item}")

    print("\n[담당자 공유용 초안]")
    print(report.draft_alert)

    llm_refined = agent.maybe_llm_refine(report)
    if llm_refined:
        print("\n[LLM 정제 리포트 (ANTHROPIC_API_KEY 감지됨)]")
        print(llm_refined)

    print(LINE + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Incident Response Copilot 데모")
    parser.add_argument("--all", action="store_true", help="모든 샘플 로그를 순서대로 실행")
    parser.add_argument("--file", type=str, help="분석할 로그 파일 경로")
    args = parser.parse_args()

    agent = IncidentResponseAgent()
    sample_files = sorted(SAMPLE_DIR.glob("*.txt"))

    if args.file:
        path = Path(args.file)
        print_report(path.name, path.read_text(encoding="utf-8"), agent)
        return

    if args.all:
        for path in sample_files:
            print_report(path.name, path.read_text(encoding="utf-8"), agent)
        return

    print("발표 데모: 분석할 샘플 로그를 선택하세요.\n")
    for i, path in enumerate(sample_files, 1):
        print(f"  {i}. {path.name}")
    print(f"  {len(sample_files) + 1}. 전체 순서대로 실행")
    print(f"  {len(sample_files) + 2}. 직접 로그 텍스트 입력")

    choice = input("\n번호 선택 > ").strip()
    try:
        idx = int(choice)
    except ValueError:
        print("잘못된 입력입니다.")
        return

    if 1 <= idx <= len(sample_files):
        path = sample_files[idx - 1]
        print_report(path.name, path.read_text(encoding="utf-8"), agent)
    elif idx == len(sample_files) + 1:
        for path in sample_files:
            print_report(path.name, path.read_text(encoding="utf-8"), agent)
    elif idx == len(sample_files) + 2:
        print("로그 텍스트를 붙여넣고 빈 줄에서 Enter 두 번으로 종료하세요:")
        lines = []
        while True:
            line = input()
            if line == "":
                break
            lines.append(line)
        print_report("custom_input", "\n".join(lines), agent)
    else:
        print("잘못된 선택입니다.")


if __name__ == "__main__":
    main()
