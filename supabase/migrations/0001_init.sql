-- Incident Response Copilot - initial schema
-- Mock securities systems (ledger / MTS) + incident knowledge base + agent-generated events.
-- Everything here is sandbox/demo data - no real customer or account information.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Mock "real system" tables: give the demo an actual environment to react to
-- ---------------------------------------------------------------------------

create table ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  account_no text not null unique,
  customer_name text not null,
  balance numeric(18, 2) not null default 0,
  updated_at timestamptz not null default now()
);

create table ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references ledger_accounts (id) on delete cascade,
  tx_type text not null check (tx_type in ('deposit', 'withdrawal', 'buy', 'sell')),
  amount numeric(18, 2) not null,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

create table mts_orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references ledger_accounts (id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  qty integer not null,
  price numeric(18, 2) not null,
  status text not null default 'pending' check (status in ('pending', 'filled', 'failed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 24/7 log stream (mock)
-- ---------------------------------------------------------------------------

create table system_logs (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  level text not null check (level in ('INFO', 'WARN', 'ERROR')),
  message text not null,
  raw_log text not null,
  created_at timestamptz not null default now()
);

create index system_logs_created_at_idx on system_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Incident knowledge base (past incidents the agent matches against)
-- ---------------------------------------------------------------------------

create table incidents_kb (
  id text primary key,
  title text not null,
  system_name text not null,
  keywords text[] not null default '{}',
  symptoms text not null,
  root_cause text not null,
  resolution jsonb not null default '[]',
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  avg_resolution_min integer not null default 30
);

-- ---------------------------------------------------------------------------
-- Agent-detected incident events + response tracking
-- ---------------------------------------------------------------------------

create table incident_events (
  id uuid primary key default gen_random_uuid(),
  detected_at timestamptz not null default now(),
  source_log_id uuid references system_logs (id),
  detected_signatures text[] not null default '{}',
  matched_incident_id text references incidents_kb (id),
  similarity_score numeric(5, 4),
  severity text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'verifying', 'resolved', 'escalated')),
  checklist jsonb not null default '[]',
  draft_report text,
  llm_summary text
);

create index incident_events_detected_at_idx on incident_events (detected_at desc);

create table checklist_progress (
  id uuid primary key default gen_random_uuid(),
  incident_event_id uuid not null references incident_events (id) on delete cascade,
  step_no integer not null,
  description text not null,
  is_done boolean not null default false,
  checked_at timestamptz,
  verification_result text
);

create index checklist_progress_event_idx on checklist_progress (incident_event_id, step_no);

create table recovery_snapshots (
  id uuid primary key default gen_random_uuid(),
  incident_event_id uuid not null references incident_events (id) on delete cascade,
  table_name text not null,
  snapshot_data jsonb not null,
  label text not null,
  taken_at timestamptz not null default now()
);

create table recovery_actions (
  id uuid primary key default gen_random_uuid(),
  incident_event_id uuid not null references incident_events (id) on delete cascade,
  snapshot_id uuid references recovery_snapshots (id),
  executed_at timestamptz not null default now(),
  result text not null check (result in ('success', 'failed')),
  verification_passed boolean not null default false,
  detail text
);

-- ---------------------------------------------------------------------------
-- Row Level Security: demo dashboard is read-only for anonymous visitors.
-- All writes go through API routes using the service role key (bypasses RLS).
-- ---------------------------------------------------------------------------

alter table ledger_accounts enable row level security;
alter table ledger_transactions enable row level security;
alter table mts_orders enable row level security;
alter table system_logs enable row level security;
alter table incidents_kb enable row level security;
alter table incident_events enable row level security;
alter table checklist_progress enable row level security;
alter table recovery_snapshots enable row level security;
alter table recovery_actions enable row level security;

create policy "public read" on ledger_accounts for select using (true);
create policy "public read" on ledger_transactions for select using (true);
create policy "public read" on mts_orders for select using (true);
create policy "public read" on system_logs for select using (true);
create policy "public read" on incidents_kb for select using (true);
create policy "public read" on incident_events for select using (true);
create policy "public read" on checklist_progress for select using (true);
create policy "public read" on recovery_snapshots for select using (true);
create policy "public read" on recovery_actions for select using (true);

-- ---------------------------------------------------------------------------
-- Realtime: let the dashboard subscribe to new logs / incidents live
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table system_logs;
alter publication supabase_realtime add table incident_events;
alter publication supabase_realtime add table checklist_progress;
alter publication supabase_realtime add table mts_orders;

-- ---------------------------------------------------------------------------
-- Seed: incident knowledge base (ported from prototype-cli/data/incidents.json)
-- ---------------------------------------------------------------------------

insert into incidents_kb (id, title, system_name, keywords, symptoms, root_cause, resolution, severity, avg_resolution_min)
values
(
  'INC-2024-0113',
  'HTS 로그인 지연 - WAS 커넥션 풀 고갈',
  'HTS (홈트레이딩시스템)',
  array['connection pool','timeout','idle object','was','로그인 지연','커넥션','sqlexception'],
  '장 시작 직후 동시 로그인 요청 급증으로 WAS 커넥션 풀이 고갈되어 로그인 응답시간이 15초 이상 지연됨. SQLException: Cannot get a connection, pool error 로그 다량 발생.',
  'WAS 커넥션 풀 max size가 피크 트래픽 대비 과소 설정되어 있었고, 일부 커넥션이 반환되지 않고 유지(leak)됨.',
  '["WAS 커넥션 풀 max/min size를 피크 시간대 기준으로 재산정","커넥션 반환 누락 여부 코드 점검 (try-with-resources 적용)","임시 조치로 WAS 인스턴스 재기동 및 커넥션 풀 강제 리셋","커넥션 풀 사용률 모니터링 알람 임계치 신설(80% 이상 시 경보)"]'::jsonb,
  'HIGH', 45
),
(
  'INC-2024-0209',
  'MTS 주문 체결 지연 - DB Lock 경합',
  'MTS (모바일트레이딩시스템)',
  array['lock wait timeout','deadlock','주문 지연','체결','db lock','장 시작'],
  '09:00 장 시작 동시 주문 폭주 구간에 주문 테이블에서 Lock wait timeout exceeded 오류가 다량 발생하며 체결 처리가 지연됨.',
  '주문 상태 업데이트 트랜잭션이 필요 이상으로 넓은 범위의 row lock을 오래 점유. 인덱스 미사용으로 인한 풀스캔성 락 확산.',
  '["주문 업데이트 쿼리에 조건 인덱스 추가 및 실행계획 점검","트랜잭션 범위를 최소 단위로 축소 (batch commit 간격 조정)","장 시작 전 커넥션/락 상태 사전 점검 체크리스트 수행","DB Lock 대기 모니터링 대시보드에 실시간 알람 연동"]'::jsonb,
  'CRITICAL', 30
),
(
  'INC-2024-0317',
  '야간 정산 배치 실패 - OutOfMemoryError',
  '계정계 배치 (정산/원장)',
  array['outofmemoryerror','heap space','배치 실패','정산','batch job'],
  '야간 정산 배치가 대용량 거래 데이터 처리 중 java.lang.OutOfMemoryError: Java heap space 발생 후 비정상 종료.',
  '일별 거래량 증가에도 JVM heap 설정이 그대로 유지되었고, 배치 로직이 전체 데이터를 한 번에 메모리에 적재하는 방식이었음.',
  '["배치 처리 방식을 청크(chunk) 단위 스트리밍 처리로 변경","JVM heap 사이즈를 실측 데이터 기준으로 재산정","실패 지점부터 재시작 가능한 체크포인트 로직 추가","익일 업무 영향 최소화를 위한 재처리 SOP 문서화"]'::jsonb,
  'CRITICAL', 90
),
(
  'INC-2024-0402',
  'OpenAPI 인증 실패 - 토큰 만료 정책 변경',
  'OpenAPI 플랫폼',
  array['401','unauthorized','token expired','인증 실패','openapi','access token'],
  '외부 제휴사 연동 OpenAPI 호출 시 401 Unauthorized 응답이 급증. 정상 발급된 토큰도 조기 만료 처리됨.',
  '인증 서버의 토큰 만료 정책(TTL)이 사전 공지 없이 변경되어 클라이언트 측 캐시된 토큰과 불일치 발생.',
  '["인증 서버 정책 변경 이력 확인 및 담당팀 공유","클라이언트 토큰 캐시 TTL을 서버 정책과 동기화","제휴사 대상 긴급 공지 발송 및 임시 토큰 재발급 가이드 제공","정책 변경 시 사전 통지 프로세스 개선 요청"]'::jsonb,
  'MEDIUM', 60
),
(
  'INC-2024-0511',
  '계정계 원장 동기화 오류 - 메시지 큐 적체',
  '계정계 (Core Banking)',
  array['mq','message queue','적체','동기화 오류','원장','consumer lag'],
  '원장 동기화용 메시지 큐에 consumer lag이 지속 증가하며 일부 거래 원장 반영이 수 분 이상 지연됨.',
  '컨슈머 인스턴스 중 하나가 예외 처리 미흡으로 메시지 처리 중 무한 재시도 루프에 빠져 전체 처리량 저하.',
  '["문제 컨슈머 인스턴스 격리 및 재기동","예외 발생 메시지는 DLQ(Dead Letter Queue)로 격리하도록 로직 보완","컨슈머 처리량 대비 파티션/컨슈머 수 재조정","consumer lag 임계치 초과 시 자동 알람 설정"]'::jsonb,
  'HIGH', 40
),
(
  'INC-2024-0623',
  '웹 트레이딩 화면 응답 지연 - CDN 캐시 미스',
  '웹 트레이딩 (대고객 채널)',
  array['cdn','cache miss','응답 지연','정적 리소스','웹 트레이딩'],
  '웹 트레이딩 화면의 정적 리소스 로딩 속도가 저하되며 전체 페이지 응답시간이 평소 대비 3배 이상 증가.',
  'CDN 설정 배포 시 캐시 무효화(purge) 범위가 과도하게 적용되어 캐시 히트율이 급감.',
  '["CDN 캐시 히트율 실시간 확인 및 원인 배포 롤백","캐시 무효화 배포 절차에 범위 검증 단계 추가","정적 리소스 버전 관리(해시 기반 파일명)로 불필요한 전체 purge 방지","CDN 캐시 히트율 모니터링 알람 신설"]'::jsonb,
  'MEDIUM', 35
),
(
  'INC-2024-0708',
  'RPA 자동매매 연동 오류 - 외부 시세 API Timeout',
  'RPA / 디지털 자동화',
  array['timeout','외부 api','시세','rpa','read timed out'],
  'RPA 기반 자동 주문 프로세스가 외부 시세 제공 API 응답 지연으로 Read timed out 오류와 함께 중단됨.',
  '외부 시세 API 제공사의 일시적 트래픽 급증으로 응답 지연 발생, RPA 측 타임아웃/재시도 로직 미흡.',
  '["RPA 프로세스에 지수 백오프(exponential backoff) 재시도 로직 추가","외부 API 이중화(백업 시세 소스) 연동 검토","타임아웃 발생 시 자동 알림 및 수동 개입 프로세스 마련","외부사 SLA 및 장애 이력 정기 점검"]'::jsonb,
  'MEDIUM', 25
),
(
  'INC-2024-0819',
  '대고객 알림톡 발송 실패 - 발송사 Rate Limit 초과',
  '대고객 알림 채널',
  array['rate limit','429','알림톡 실패','발송 실패','gateway'],
  '체결/입출금 알림톡 발송 시 429 Too Many Requests 응답 다수 발생하며 알림 발송 성공률이 급락.',
  '이벤트성 대량 발송 트래픽이 3rd party 발송 게이트웨이의 초당 요청 제한(Rate Limit)을 초과.',
  '["발송 큐잉 및 초당 발송량 제어(throttling) 로직 적용","발송사와 Rate Limit 상향 협의","실패 건 재발송 큐 별도 관리","발송 성공률 실시간 모니터링 및 임계치 알람 설정"]'::jsonb,
  'MEDIUM', 30
);

-- ---------------------------------------------------------------------------
-- Seed: mock ledger accounts + a handful of filled MTS orders so the
-- "impact simulation / recovery" flow has real rows to perturb and restore.
-- ---------------------------------------------------------------------------

insert into ledger_accounts (account_no, customer_name, balance)
values
  ('ACC-10001', '김민준', 15320000),
  ('ACC-10002', '이서연', 8420000),
  ('ACC-10003', '박도윤', 42110000),
  ('ACC-10004', '최지우', 2310000),
  ('ACC-10005', '정하윤', 63900000);

insert into mts_orders (account_id, symbol, side, qty, price, status, created_at)
select
  a.id,
  s.symbol,
  s.side,
  s.qty,
  s.price,
  'filled',
  now() - (s.minutes_ago || ' minutes')::interval
from ledger_accounts a
join (
  values
    ('ACC-10001', '005930', 'buy', 10, 71500, 3),
    ('ACC-10002', '000660', 'sell', 5, 182300, 7),
    ('ACC-10003', '035420', 'buy', 20, 198500, 12),
    ('ACC-10004', '005380', 'buy', 3, 245000, 18),
    ('ACC-10005', '051910', 'sell', 8, 412000, 25)
) as s(account_no, symbol, side, qty, price, minutes_ago)
  on s.account_no = a.account_no;
