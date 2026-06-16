-- ============================================================================
--  SC Wheels — Phase 5 migration  (Work Plan v1)
--
--  A simple shared "factory work focus" board: owner/admin record what the
--  factory should focus on today or tomorrow, and office/warehouse/factory see
--  the same intent without walking to ask. ADDITIVE ONLY.
--
--  This is INFORMATION ONLY. It must NOT:
--    - touch any stock balance
--    - create wheels_transactions / production / sale rows
--    - deduct raw materials or check BOMs
--  Nothing here references the movement engine — it is a standalone log.
--
--  Run once in the Supabase SQL editor after phase1/2/3/4. Idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  Work plan items. product_id points at a box/assembly SKU, but sku +
--  display_name are SNAPSHOTTED at creation so the plan still reads even if the
--  catalog later changes. No FK on product_id (snapshot semantics, delete-safe).
-- ---------------------------------------------------------------------------
create table if not exists public.wheels_work_plan_items (
  id           uuid primary key default gen_random_uuid(),
  plan_date    date not null default current_date,
  product_kind text not null,                       -- 'box' | 'assembly'
  product_id   uuid not null,                        -- → wheels_boxes.id / wheels_assemblies.id
  sku          text not null,                        -- snapshot at creation
  display_name text not null,                        -- snapshot at creation
  quantity     int  not null,
  unit         text not null,
  status       text not null default 'planned',      -- planned|in_progress|done|cancelled
  note         text,
  created_by   text,
  updated_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  cancelled_at timestamptz
);

-- By-day listing (Today / Tomorrow) and the PAC "is this SKU planned?" lookup.
create index if not exists wheels_work_plan_date_idx   on public.wheels_work_plan_items (plan_date);
create index if not exists wheels_work_plan_lookup_idx on public.wheels_work_plan_items (sku, plan_date);

-- ---------------------------------------------------------------------------
--  RLS — authenticated admin full access (same model as schema.sql / phase 2).
-- ---------------------------------------------------------------------------
alter table public.wheels_work_plan_items enable row level security;
drop policy if exists admin_all on public.wheels_work_plan_items;
create policy admin_all on public.wheels_work_plan_items for all to authenticated using (true) with check (true);
