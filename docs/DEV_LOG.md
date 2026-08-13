# 개발 로그

## 1단계 — CLI 프로토타입 (`prototype-cli/`)

과제 발표(2026-08-13, 시스템 개발 및 운영 직군)를 위한 최초 버전.
Python 표준 라이브러리만으로 동작하는 "장애 대응 지원 Agent" CLI 데모.
로그를 입력하면 에러 시그니처를 추출하고, TF-IDF 유사도로 과거 장애
8건과 비교해 체크리스트와 보고 초안을 생성. 외부 API 의존성 없이
발표장 네트워크 상태와 무관하게 시연 가능하도록 설계.

## 2단계 — 웹서비스 확장

발표 이후 다음 요구사항으로 확장:

| 요구사항 | 구현 |
|---|---|
| 24시간 구동하며 이상 유무 확인 | `runMonitoringTick()` + Vercel Cron + 데모용 수동/자동 트리거 |
| 로그 분석 + 과거 사고 비교/제시 | CLI의 TF-IDF 엔진을 TypeScript로 포팅 (`src/lib/agent/similarity.ts`) |
| 대응 절차 개조식 설명 + 실시간 확인 | `checklist_progress` 테이블 + `/incidents/[id]` 체크박스 UI |
| 테스트 데이터로 정상 작동 체크 | `runVerification()` — 합성 테스트 주문으로 영향 데이터 상태 확인 |
| 시스템 원복 · DB 복구 | `runRecovery()` — `recovery_snapshots` 기반 샌드박스 롤백 |
| Supabase DB | `supabase/migrations/0001_init.sql` — 원장/MTS/지식베이스/장애이벤트 스키마 |
| 실제 운영 환경 느낌 | 모의 계정계 원장(`ledger_accounts`) + MTS 주문(`mts_orders`) 시드 데이터 |
| GitHub / Vercel 배포 | `docs/SETUP.md` 절차 참고 |

각 항목을 "왜 이렇게 정했는가"는 [DECISIONS.md](DECISIONS.md)에 별도 기록.

## 알게 된 것 / 막혔던 것

- **OneDrive + node_modules 충돌**: 최초 작업 경로(OneDrive 동기화 폴더)에서
  `npm install`이 네이티브 모듈 설치 중 반복적으로 segfault. 프로젝트를
  `~/projects/incident_agent`로 옮긴 뒤 해결. (DECISIONS.md 5번)
- **Next.js 16 route handler 규칙**: 이 버전은 route handler의 동적 세그먼트
  파라미터가 `Promise` (`await ctx.params`)이고, 타입은 전역
  `RouteContext<'/api/...'>` 헬퍼로 받습니다. 프로젝트 생성 시 함께 만들어진
  `AGENTS.md`가 "학습 데이터와 다를 수 있으니 `node_modules/next/dist/docs/`를
  먼저 확인하라"고 안내해, 실제 라우트 핸들러 문서를 확인한 뒤 코드를
  작성했습니다.
- **Vercel Cron 빈도 제한**: 무료(Hobby) 플랜은 cron 실행 빈도에 제약이
  있을 수 있어, "24시간 자동 실행"과 별개로 데모 시연용 수동/자동(4초 간격)
  트리거를 대시보드에 둬 발표가 cron 스케줄에 의존하지 않도록 했습니다.

## 3단계 — 관제·대응 기능 강화 (2026-08-13)

사용자 피드백으로 다음 8가지를 추가했습니다. 자세한 설계 배경은
[ARCHITECTURE.md](ARCHITECTURE.md)의 "2단계 확장" 절, 의사결정 이유는
[DECISIONS.md](DECISIONS.md) 6~9번 참고.

1. 실시간 로그 스트림이 살아있게 보이도록 fade-in 애니메이션 + LIVE 인디케이터
2. 로그 키워드 검색 + 날짜/위험도/발생 시스템 필터
3. 필터에 따라 로그·장애 목록이 실제로 좁혀지는 표시
4. 명시적인 "장애 조치 완료" 처리 액션 (+ 복구 대상이 없는 장애가 영원히
   `resolved`가 되지 않던 기존 버그 수정)
5. 권장 조치(체크리스트 → 검증 → 복구) 사용자 승인 후 자동 실행
6. 시스템 구조도(토폴로지) + 실시간 장애 위치 표시, 장애별 영향 범위/피해 규모 계산
7. 담당자 SMS/이메일 알림 — 실제 발송 대신 완전 시뮬레이션(발송 로그만 기록)
8. 자체 도출한 개선: `incident_events` 실시간 구독 배열 무제한 증가 방지,
   24시간 장애 발생 추이 스파크라인, 현재 당직자 로스터 표시, 필터 상태
   `sessionStorage` 유지

이 작업은 `supabase/migrations/0002_ops_enhancements.sql`을 새로
추가했습니다. **이 마이그레이션을 Supabase SQL Editor에서 실행하기
전까지는 장애 감지 파이프라인이 `incident_events.source_system` 컬럼이
없다는 오류로 실패합니다** — 로그 생성 자체(INFO/WARN)는 영향 없지만,
ERROR 로그로 장애가 감지되는 순간부터 막힙니다. 배포 직후 가장 먼저
확인해야 할 항목입니다.

## 다음에 하면 좋을 것

- 실시간 로그 소스를 실제 로그 수집기(ELK/Splunk 등)와 연동
- 해결된 신규 패턴을 지식베이스에 자동 등록하는 피드백 루프
- 복구 실행 전 사람의 승인 단계 + 감사 로그 (실제 운영 적용 시 필수)
- 로그인/역할 기반 접근 제어 (현재는 데모 목적의 완전 공개 읽기 구조)
- 알림 기능을 실제 발송사(Twilio/Resend 등)와 연동 (현재는 시뮬레이션)
