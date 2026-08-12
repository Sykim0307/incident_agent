# Incident Response Copilot (CLI 프로토타입)

> 이 폴더는 최초 발표용 Python CLI 버전입니다. 웹서비스 버전(Next.js +
> Supabase, 24/7 시뮬레이션 · 체크리스트 실시간 확인 · 복구 시뮬레이션 포함)은
> 저장소 루트를 참고하세요 — [../README.md](../README.md)

시스템 개발 및 운영 직군을 위한 장애 대응 지원 Agent 데모.

## 실행 방법

```
cd incident_agent
python demo.py --all          # 샘플 로그 4개 전체 순서대로 실행 (발표용 추천)
python demo.py                # 메뉴에서 샘플을 골라 실행 (대화형)
python demo.py --file sample_logs\log2_db_lock.txt   # 특정 로그 하나만 실행
```

Python 3.9+ 표준 라이브러리만 사용하므로 별도 설치 없이 바로 실행됩니다.

## 데모 시나리오 (sample_logs/)

| 파일 | 상황 | Agent 판단 |
|---|---|---|
| log1_connection_pool.txt | HTS 로그인 지연, 커넥션 풀 고갈 | 과거 사례 매칭 → 체크리스트 제시 |
| log2_db_lock.txt | 장 시작 MTS 주문 지연, DB Lock 경합 | 과거 사례 매칭 → 체크리스트 제시 |
| log3_batch_oom.txt | 야간 정산 배치 OOM | 과거 사례 매칭 → 체크리스트 제시 |
| log4_unknown_pattern.txt | 디스크 풀 (신규 유형) | 유사 사례 없음 → 에스컬레이션 권고 |

마지막 시나리오(log4)는 일부러 지식베이스에 없는 패턴으로 구성했습니다.
"모르면 모른다고 하고 사람에게 넘긴다"는 Agent의 안전장치를 발표 중 보여주기 위한 장치입니다.

## 동작 원리

1. `agent.py`의 `extract_error_signatures()`가 로그에서 예외명/HTTP 코드/타임아웃 등
   에러 시그니처를 정규식으로 추출합니다.
2. `IncidentKnowledgeBase`가 `data/incidents.json`(과거 장애 8건)을 TF-IDF 벡터화하고,
   입력 로그와 코사인 유사도를 계산해 가장 유사한 과거 사례를 찾습니다.
3. 유사도가 임계치(`MATCH_THRESHOLD`) 미만이면 "신규 패턴"으로 판단해
   원인 추정 대신 에스컬레이션을 권고합니다.
4. 매칭된 사례의 원인/해결 이력을 바탕으로 체크리스트와 담당자 공유용 보고 초안을 생성합니다.

## 선택 기능: LLM 정제

환경변수 `ANTHROPIC_API_KEY`가 설정되어 있고 `pip install anthropic`이 되어 있으면,
Agent가 만든 초안을 Claude가 한 번 더 자연스러운 문장으로 다듬어 함께 보여줍니다.
키가 없어도 나머지 기능은 그대로 동작합니다 (오프라인 발표 환경 대비).

## 실제 도입 시 확장 방향

- 로그 소스를 파일이 아닌 실시간 로그 수집기(ELK, Splunk 등)와 연동
- `incidents.json`을 실제 장애 이력 DB/위키와 연동해 자동 축적
- 매칭 결과를 Slack/사내 메신저로 자동 발송 + 담당자 자동 배정
- 신규 패턴 발생 시 해결 완료 후 지식베이스 자동 등록 루프 구성
