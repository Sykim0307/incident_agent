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

## 다음에 하면 좋을 것

- 실시간 로그 소스를 실제 로그 수집기(ELK/Splunk 등)와 연동
- 해결된 신규 패턴을 지식베이스에 자동 등록하는 피드백 루프
- 복구 실행 전 사람의 승인 단계 + 감사 로그 (실제 운영 적용 시 필수)
- 로그인/역할 기반 접근 제어 (현재는 데모 목적의 완전 공개 읽기 구조)
