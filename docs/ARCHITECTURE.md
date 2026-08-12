# 아키텍처

## 전체 구조

```
┌─────────────┐   POST /api/demo/tick        ┌───────────────────────┐
│  대시보드    │ ───────────────────────────▶ │ runMonitoringTick()   │
│ (브라우저)   │   (수동 트리거, 4초 자동반복) │  src/lib/agent/tick.ts│
└──────┬──────┘                               └──────────┬─────────────┘
       │  GET  /api/cron/generate-logs                    │
       │◀──────────── Vercel Cron ────────────────────────┘
       │                                                   │
       │ Supabase Realtime                                 ▼
       │ (system_logs, incident_events                ┌─────────────┐
       │  구독)                                        │  Supabase   │
       └───────────────────────────────────────────▶  │  Postgres   │
                                                        └─────────────┘
```

1. **로그 발생** — `runMonitoringTick()`이 모의 로그 한 줄을 만들어
   `system_logs`에 저장합니다. 정상(INFO/WARN)이면 여기서 끝, ERROR면 계속.
2. **분석** — `extractErrorSignatures()`로 에러 시그니처를 뽑고,
   `searchSimilarIncidents()`가 `incidents_kb`(과거 장애 8건)와 TF-IDF
   코사인 유사도를 계산합니다. 임계치(`MATCH_THRESHOLD = 0.12`) 이상이면
   매칭, 미만이면 "신규 패턴"으로 판단해 에스컬레이션 체크리스트를 씁니다.
3. **기록** — `incident_events` 행 하나와, 체크리스트 항목 수만큼
   `checklist_progress` 행을 만듭니다.
4. **영향 시뮬레이션(선택)** — DB Lock 계열 장애(`INC-2024-0209`)는
   `simulateMtsImpact()`가 최근 체결된 `mts_orders` 몇 건을 `failed`로
   바꾸고, 원래 상태를 `recovery_snapshots`에 저장해 "복구할 거리"를 만듭니다.
5. **LLM 요약(선택)** — `ANTHROPIC_API_KEY`가 있으면 Claude가 구조화된
   분석 결과를 자연어 요약(`llm_summary`)으로 다듬습니다. 없으면 이 단계는
   조용히 건너뜁니다 — 나머지 파이프라인은 그대로 동작합니다.
6. **대응** — `/incidents/[id]` 페이지에서 체크리스트를 체크하면
   `POST /api/incidents/[id]/checklist`가 진행상황을 기록합니다. 모두
   완료되면 `POST /api/incidents/[id]/verify`로 테스트 주문을 넣어 영향
   받은 데이터가 아직 깨져 있는지 확인하고, `POST /api/incidents/[id]/recover`가
   `recovery_snapshots`를 읽어 원래 상태로 되돌립니다.

## "24시간 구동"을 실제로 어떻게 구현했는가

Vercel의 서버리스 함수는 상시 구동 프로세스가 아니라 요청 시에만 실행됩니다.
그래서 두 가지 트리거를 함께 둡니다.

- **Vercel Cron** (`vercel.json`) — `/api/cron/generate-logs`를 주기적으로
  호출해 백엔드가 스스로 로그를 만들어내는, 실제 "자동 실행"을 담당합니다.
  무료(Hobby) 플랜은 cron 실행 빈도에 제약이 있을 수 있어 `docs/SETUP.md`에
  대안을 함께 적어두었습니다.
- **데모 버튼 / 자동 시뮬레이션 토글** (`/api/demo/tick`) — 발표·데모 중에는
  cron 주기와 무관하게 즉시 로그를 만들어야 하므로, 대시보드에 같은 로직을
  호출하는 버튼과 4초 간격 자동 반복 토글을 뒀습니다. cron과 완전히 같은
  `runMonitoringTick()` 함수를 호출하므로 두 경로의 동작은 100% 동일합니다.

## 데이터 모델

`supabase/migrations/0001_init.sql` 기준.

| 테이블 | 역할 |
|---|---|
| `ledger_accounts` / `ledger_transactions` | 모의 계정계 원장 |
| `mts_orders` | 모의 MTS 주문 (장애 영향/복구 시연 대상) |
| `system_logs` | 24/7 로그 스트림 |
| `incidents_kb` | 과거 장애 지식베이스 (8건 시드) |
| `incident_events` | Agent가 실제로 감지한 장애 |
| `checklist_progress` | 장애별 체크리스트 진행상황 |
| `recovery_snapshots` | 복구용 스냅샷 (장애 발생 전 데이터) |
| `recovery_actions` | 복구 실행 이력 |

모든 테이블은 RLS를 켜고 `select`만 공개했습니다. 쓰기는 전부 API 라우트가
service role 키로 수행합니다(클라이언트에는 절대 노출되지 않음).

## 왜 이 안전장치가 중요한가

- **모른다고 말하기** — 유사도가 임계치 미만이면 그럴듯한 원인을 지어내지
  않고 에스컬레이션을 권고합니다 (`ESCALATION_CHECKLIST`, `tick.ts`).
- **복구는 샌드박스 안에서만** — `recover.ts`는 이 프로젝트가 만든
  `mts_orders`/`recovery_snapshots` 테이블만 다룹니다. 실제 운영 시스템에
  적용하려면 승인·감사 로그·롤백 계획이 있는 별도 설계가 필요합니다
  (자세한 논의는 [DECISIONS.md](DECISIONS.md) 참고).
