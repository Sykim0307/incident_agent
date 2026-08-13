-- Incident Response Copilot - ops enhancements
-- Adds: denormalized incident source system + explicit closure metadata,
-- a simulated on-call roster, and a simulated notification log.
-- Nothing here sends real SMS/email - see src/lib/agent/notify.ts.

-- ---------------------------------------------------------------------------
-- incident_events: denormalized source system (for filtering/topology) +
-- explicit resolution metadata (fixes the case where a non-impacting
-- incident had no data to restore and therefore never flipped to resolved).
-- ---------------------------------------------------------------------------

alter table incident_events add column source_system text;
alter table incident_events add column resolved_at timestamptz;
alter table incident_events add column resolution_method text
  check (resolution_method in ('recovery', 'manual'));
alter table incident_events add column resolution_note text;

update incident_events e
set source_system = l.source_system
from system_logs l
where e.source_log_id = l.id and e.source_system is null;

-- ---------------------------------------------------------------------------
-- On-call roster (mock/demo contacts only - no real people or numbers)
-- ---------------------------------------------------------------------------

create table on_call_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  channel text not null check (channel in ('sms', 'email')),
  contact_address text not null,
  system_scope text[] not null default '{}',
  active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Notification log - fully simulated. src/lib/agent/notify.ts only ever
-- inserts rows here; it never calls an external SMS/email provider.
-- ---------------------------------------------------------------------------

create table notifications (
  id uuid primary key default gen_random_uuid(),
  incident_event_id uuid not null references incident_events (id) on delete cascade,
  contact_id uuid references on_call_contacts (id),
  channel text not null check (channel in ('sms', 'email')),
  recipient text not null,
  message text not null,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  sent_at timestamptz not null default now(),
  simulated boolean not null default true
);

create index notifications_event_idx on notifications (incident_event_id, sent_at desc);

-- ---------------------------------------------------------------------------
-- RLS: same "public read, service-role write" pattern as 0001_init.sql
-- ---------------------------------------------------------------------------

alter table on_call_contacts enable row level security;
alter table notifications enable row level security;

create policy "public read" on on_call_contacts for select using (true);
create policy "public read" on notifications for select using (true);

-- ---------------------------------------------------------------------------
-- Realtime: notification rows should show up live on the incident page
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table notifications;

-- ---------------------------------------------------------------------------
-- Seed: demo on-call roster (all contact info is fictional / for-demo-only)
-- ---------------------------------------------------------------------------

insert into on_call_contacts (name, role, channel, contact_address, system_scope) values
  ('김도현', '인프라 당직 엔지니어', 'sms', '010-0000-1111 (모의)', '{}'),
  ('이수민', 'MTS/HTS 운영 담당', 'email', 'msoo.demo@example-mock.local', array['HTS','MTS','웹 트레이딩']),
  ('박지훈', '계정계 운영 담당', 'email', 'jipark.demo@example-mock.local', array['계정계','계정계 배치']),
  ('정하람', '대외 연동/알림 담당', 'sms', '010-0000-2222 (모의)', array['OpenAPI','RPA','대고객 알림']);
