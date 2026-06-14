-- ============================================================================
--  SC Inventory Management — Phase 4 migration
--  Run in the Supabase SQL editor IF you already provisioned an earlier schema.
--  (A fresh schema.sql already includes everything here.) Idempotent.
--
--  Adds:
--    • notification_logs  — idempotency guard preventing duplicate LINE sends.
--    • default 'line' row in app_settings.
-- ============================================================================

create table if not exists public.notification_logs (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,
  period_key text not null,
  status     text not null default 'sending',
  recipient  text,
  detail     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, period_key)
);

alter table public.notification_logs enable row level security;
drop policy if exists admin_all on public.notification_logs;
create policy admin_all on public.notification_logs
  for all to authenticated using (true) with check (true);

-- default LINE settings (only inserted if absent)
insert into public.app_settings (key, value)
values ('line', '{
  "enabled": false,
  "token": "",
  "recipientId": "",
  "recipientName": "กลุ่มผู้ดูแลโรงงาน SC",
  "detail": "summary",
  "dailyTrigger": "after",
  "fallbackTime": "19:30",
  "weeklyDay": 1,
  "weeklyTime": "08:00",
  "monthlyDay": 1,
  "monthlyTime": "08:00",
  "lowstockMode": "digest",
  "lowstockMax": 5,
  "headerText": "",
  "footerText": ""
}'::jsonb)
on conflict (key) do nothing;
