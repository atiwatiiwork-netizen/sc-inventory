-- ============================================================================
--  SC Inventory Management — Database schema
--  Steel-rail factory inventory + daily usage tracking.
--
--  Designed to support every planned phase without redesign:
--    Phase 1 — auth, categories, products            (implemented now)
--    Phase 2 — stock input, worker daily submissions
--    Phase 3 — dashboard, reports, low-stock
--    Phase 4 — LINE settings
--
--  Run this in the Supabase SQL editor, then run seed.sql.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
--  Lookups (extensible — new reporting units never require a schema change)
-- ---------------------------------------------------------------------------
create table if not exists public.report_units (
  id   text primary key,          -- 'm', 'pcs', 'box', 'can', ...
  th   text not null,
  sort int  not null default 0
);

create table if not exists public.viz_types (
  id text primary key,            -- 'rail' | 'product' | 'trend'
  th text not null,
  en text not null
);

-- ---------------------------------------------------------------------------
--  Admin profiles (1:1 with Supabase auth users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null default 'ผู้ดูแล',
  role       text not null default 'admin',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  Categories — each defines its OWN reporting behaviour so dashboards never
--  mix incompatible units.
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id                text primary key,                 -- slug, e.g. 'rails'
  name              text not null,
  name_en           text,
  display_order     int  not null default 0,
  report_unit       text references public.report_units(id),
  report_unit_th    text,
  secondary_unit    text,
  secondary_unit_th text,
  viz               text references public.viz_types(id) default 'product',
  active            boolean not null default true,
  archived          boolean not null default false,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  Products (SKUs)
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  sku           text not null unique,
  name          text not null,
  name_en       text,
  category_id   text references public.categories(id),
  unit          text,                -- display unit, e.g. 'เส้น'
  unit_en       text,
  size          text,                -- rails only, e.g. '1"'
  length        text,                -- rails only, e.g. '3m'
  length_m      numeric,             -- rails only, drives meters calc
  stock         int not null default 0,
  min_stock     int not null default 0,
  display_order int not null default 0,
  description   text,
  active        boolean not null default true,
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category_id);

-- ---------------------------------------------------------------------------
--  Customer groups (segments the worker selects)
-- ---------------------------------------------------------------------------
create table if not exists public.customer_groups (
  id         text primary key,
  name       text not null,
  name_en    text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  Workers (PIN login)
-- ---------------------------------------------------------------------------
create table if not exists public.workers (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,    -- EMP001
  name       text not null,
  name_en    text,
  pin        text not null,           -- 4-digit
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  Stock transactions  (Phase 2) — grouped UI, SKU-level storage
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.txn_type as enum ('in', 'adjust', 'out');
exception when duplicate_object then null; end $$;

create table if not exists public.stock_transactions (
  id         uuid primary key default gen_random_uuid(),
  txn_date   date not null default current_date,
  product_id uuid references public.products(id),
  type       public.txn_type not null,
  qty           int not null,         -- signed: +received / -used / ±adjust
  note          text,
  created_by    text,                 -- 'admin' or worker code
  submission_id uuid,                 -- worker out-txns only → daily_submissions (FK added below)
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  Worker daily submissions  (Phase 2)
-- ---------------------------------------------------------------------------
create table if not exists public.daily_submissions (
  id                uuid primary key default gen_random_uuid(),
  worker_id         uuid references public.workers(id),
  usage_date        date not null,
  customer_group_id text references public.customer_groups(id),
  no_usage          boolean not null default false,
  status            text not null default 'submitted',
  submitted_at      timestamptz not null default now(),
  -- one record per (worker, day, customer group) so a worker can record
  -- several customer groups in the same day; re-submitting a group edits it.
  unique (worker_id, usage_date, customer_group_id)
);

create table if not exists public.submission_items (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid references public.daily_submissions(id) on delete cascade,
  product_id    uuid references public.products(id),
  qty           int not null
);

-- Traceability: worker out-transactions link back to their daily submission.
-- Used ONLY for worker-generated stock outputs (admin receiving leaves it null).
do $$ begin
  alter table public.stock_transactions
    add constraint stock_transactions_submission_fk
    foreign key (submission_id) references public.daily_submissions(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
--  Physical-count adjustments  (Phase 2/3)
-- ---------------------------------------------------------------------------
create table if not exists public.adjustments (
  id          uuid primary key default gen_random_uuid(),
  adj_date    date not null default current_date,
  product_id  uuid references public.products(id),
  system_qty  int,
  actual_qty  int,
  diff        int,
  note        text,
  created_by  text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  Audit log
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id     uuid primary key default gen_random_uuid(),
  ts     timestamptz not null default now(),
  who    text,
  action text,
  detail text
);

-- ---------------------------------------------------------------------------
--  App settings (LINE, etc — Phase 4)
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key   text primary key,
  value jsonb
);

-- ---------------------------------------------------------------------------
--  Notification logs (Phase 4) — idempotency guard for LINE sends.
--  unique(kind, period_key) ensures a given daily/weekly/monthly message is
--  sent at most once, even if both the after-submit trigger and the Vercel
--  Cron fallback fire for the same period.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_logs (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,            -- 'daily' | 'weekly' | 'monthly' | 'lowstock' | 'test'
  period_key text not null,            -- '2026-06-12' | '2026-W24' | '2026-06'
  status     text not null default 'sending', -- 'sending' | 'sent' | 'failed' | 'skipped'
  recipient  text,
  detail     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, period_key)
);

-- ===========================================================================
--  Auth helpers
-- ===========================================================================

-- Auto-create a profile row when an admin signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'ผู้ดูแล'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Verify a worker PIN without exposing the workers table to the client.
-- SECURITY DEFINER so it can read workers under RLS; called server-side.
create or replace function public.worker_login(p_pin text)
returns table (id uuid, code text, name text, name_en text)
language sql
security definer set search_path = public
as $$
  select w.id, w.code, w.name, w.name_en
  from public.workers w
  where w.pin = p_pin and w.active = true
  limit 1;
$$;
revoke all on function public.worker_login(text) from public;

-- ===========================================================================
--  Phase 2 — atomic commit functions (grouped UI → SKU-level storage)
--  Each runs as a single transaction so a confirmed submission is all-or-nothing.
-- ===========================================================================

-- Admin grouped receiving → one 'in' transaction per SKU + stock increment.
-- p_lines: jsonb array of { "product_id": uuid, "qty": int }.
create or replace function public.receive_stock(
  p_date date,
  p_note text,
  p_by   text,
  p_lines jsonb
) returns int
language plpgsql
security definer set search_path = public
as $$
declare
  line jsonb;
  pid  uuid;
  n    int;
  cnt  int := 0;
begin
  for line in select * from jsonb_array_elements(p_lines)
  loop
    pid := (line->>'product_id')::uuid;
    n   := (line->>'qty')::int;
    if pid is null or n is null or n = 0 then continue; end if;
    insert into public.stock_transactions(txn_date, product_id, type, qty, note, created_by)
    values (p_date, pid, 'in', n, nullif(p_note, ''), coalesce(p_by, 'admin'));
    update public.products set stock = stock + n where id = pid;
    cnt := cnt + 1;
  end loop;
  insert into public.audit_log(who, action, detail)
  values (coalesce(p_by, 'admin'), 'รับสินค้าเข้า', format('%s รายการ · วันที่ %s', cnt, p_date));
  return cnt;
end;
$$;

-- Worker daily usage → daily_submissions header + submission_items + mirrored
-- 'out' transactions (qty negative, linked via submission_id) + stock decrement.
-- Idempotent for the same (worker, date): re-submitting reverses the previous
-- effect first, so a worker can edit today's submission cleanly.
-- p_lines: jsonb array of { "product_id": uuid, "qty": int }.
create or replace function public.submit_daily_usage(
  p_worker   uuid,
  p_date     date,
  p_group    text,
  p_no_usage boolean,
  p_lines    jsonb
) returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  sub_id uuid;
  line   jsonb;
  pid    uuid;
  n      int;
  prev   record;
  w_code text;
begin
  select code into w_code from public.workers where id = p_worker;

  -- match the existing record for THIS customer group (or the no-usage record),
  -- so different groups accumulate instead of overwriting each other.
  if p_no_usage then
    select id into sub_id from public.daily_submissions
      where worker_id = p_worker and usage_date = p_date and no_usage = true
      limit 1;
  else
    select id into sub_id from public.daily_submissions
      where worker_id = p_worker and usage_date = p_date
        and customer_group_id is not distinct from p_group
      limit 1;
  end if;

  if sub_id is not null then
    -- reverse only THIS group's previous stock effect (edit case)
    for prev in
      select product_id, qty from public.stock_transactions
      where submission_id = sub_id and type = 'out'
    loop
      -- prev.qty is negative; subtracting it restores the stock
      update public.products set stock = stock - prev.qty where id = prev.product_id;
    end loop;
    delete from public.stock_transactions where submission_id = sub_id;
    delete from public.submission_items   where submission_id = sub_id;
    update public.daily_submissions
      set customer_group_id = p_group, no_usage = p_no_usage,
          status = 'submitted', submitted_at = now()
      where id = sub_id;
  else
    insert into public.daily_submissions(worker_id, usage_date, customer_group_id, no_usage, status)
    values (p_worker, p_date, p_group, p_no_usage, 'submitted')
    returning id into sub_id;
  end if;

  if not p_no_usage then
    for line in select * from jsonb_array_elements(p_lines)
    loop
      pid := (line->>'product_id')::uuid;
      n   := (line->>'qty')::int;
      if pid is null or n is null or n = 0 then continue; end if;
      insert into public.submission_items(submission_id, product_id, qty)
      values (sub_id, pid, n);
      insert into public.stock_transactions(txn_date, product_id, type, qty, note, created_by, submission_id)
      values (p_date, pid, 'out', -n, 'การใช้ประจำวัน', coalesce(w_code, 'worker'), sub_id);
      update public.products set stock = stock - n where id = pid;
    end loop;
  end if;

  insert into public.audit_log(who, action, detail)
  values (coalesce(w_code, 'worker'), 'ส่งข้อมูลการใช้ประจำวัน',
          format('%s · วันที่ %s',
                 coalesce((select name from public.customer_groups where id = p_group), 'ไม่มีการใช้งาน'),
                 p_date));
  return sub_id;
end;
$$;

-- ===========================================================================
--  Row-level security
--  Only administrators authenticate via Supabase Auth, so "authenticated"
--  means "admin" → full access. Workers never touch these tables directly;
--  their reads/writes go through server actions using the service role.
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'report_units','viz_types','profiles','categories','products',
    'customer_groups','workers','stock_transactions','daily_submissions',
    'submission_items','adjustments','audit_log','app_settings','notification_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists admin_all on public.%I;', t);
    execute format(
      'create policy admin_all on public.%I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;
