-- ============================================================================
--  SC Wheels — Phase 7 migration  (Production Ticket v1)
--
--  A production TICKET is a human-reviewed REQUEST raised (optionally) from the
--  Stock Ready Check, or created manually. It is decision support — NOT a
--  production plan, schedule, or order. ADDITIVE ONLY; run after phase1..6.
--
--  This module must NOT:
--    - reserve or deduct stock
--    - create wheels_transactions / production / sale rows
--    - auto-create Work Plan items or auto-schedule anything
--  It only stores the request; every status change is manual.
-- ============================================================================

create table if not exists public.wheels_production_tickets (
  id            uuid primary key default gen_random_uuid(),
  ticket_date   date not null default current_date,
  source        text not null default 'manual',     -- 'stock_check' | 'manual'
  product_kind  text not null,                       -- 'box' | 'assembly'
  product_id    uuid not null,                       -- → wheels_boxes / wheels_assemblies (snapshot semantics, no FK)
  sku           text not null,                       -- snapshot at creation
  display_name  text not null,                       -- snapshot at creation
  unit          text not null,
  current_stock int  not null,                       -- snapshot at creation
  min_stock     int  not null default 0,             -- snapshot at creation
  requested_qty int  not null default 0,             -- customer-requested volume (0 = manual/unknown)
  suggested_qty int  not null default 0,             -- "จำนวนที่ควรทำเติมเบื้องต้น" — informational, editable
  timing_kind   text not null default 'custom',      -- 'custom' | 'today' | 'within_hours' | 'now'
  timing_date   date,                                -- when timing_kind = 'custom'
  timing_hours  int,                                 -- when timing_kind = 'within_hours'
  note          text,
  status        text not null default 'open',         -- open|in_review|accepted|rejected|done|cancelled
  created_by    text,
  updated_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists wheels_tickets_status_idx on public.wheels_production_tickets (status, created_at desc);

-- RLS — authenticated admin full access (same model as schema.sql / phase 2).
-- Worker-side creation goes through the service role (server actions), as with production.
alter table public.wheels_production_tickets enable row level security;
drop policy if exists admin_all on public.wheels_production_tickets;
create policy admin_all on public.wheels_production_tickets for all to authenticated using (true) with check (true);
