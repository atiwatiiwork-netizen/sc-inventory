-- ============================================================================
--  SC Wheels — Phase 6 migration  (Wooden Crate Inventory v1)
--
--  PASSIVE VISIBILITY ONLY. Chinese wooden crates hold ~2000–2400 raw wheels
--  each (varies by SKU). This records how many crates of each raw wheel are on
--  hand, maintained MANUALLY by a human, so the factory can plan with that in
--  view. ADDITIVE ONLY; run once after phase1..5. Idempotent.
--
--  This module is DELIBERATELY DISCONNECTED from the movement engine. It must
--  NOT:
--    - touch wheels_raw/boxes/assemblies stock balances
--    - create wheels_transactions / production / sale rows
--    - auto-deduct on packing, assembly, or sales (no BOM integration)
--  Crate quantity changes ONLY through manual adjustments recorded here.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  One crate-inventory record per raw-wheel SKU. crate_qty is the current
--  number of crates on hand; pieces_per_crate is the human-maintained count.
-- ---------------------------------------------------------------------------
create table if not exists public.wheels_crates (
  id              uuid primary key default gen_random_uuid(),
  raw_id          uuid not null references public.wheels_raw(id) on delete restrict,
  pieces_per_crate int  not null default 2000,
  crate_qty       int  not null default 0,
  note            text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (raw_id)
);

-- ---------------------------------------------------------------------------
--  Manual adjustment history (basic, like SC Inventory adjustments). Records
--  every human change to crate_qty with before/after. No automatic rows ever.
-- ---------------------------------------------------------------------------
create table if not exists public.wheels_crate_moves (
  id          uuid primary key default gen_random_uuid(),
  crate_id    uuid not null references public.wheels_crates(id) on delete cascade,
  delta       int  not null,           -- signed change applied to crate_qty
  before_qty  int  not null,
  after_qty   int  not null,
  note        text,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists wheels_crate_moves_idx on public.wheels_crate_moves (crate_id, created_at desc);

-- ---------------------------------------------------------------------------
--  RLS — authenticated admin full access (same model as schema.sql / phase 2).
-- ---------------------------------------------------------------------------
do $do$
declare t text;
begin
  foreach t in array array['wheels_crates', 'wheels_crate_moves']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists admin_all on public.%I;', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (true) with check (true);', t);
  end loop;
end $do$;
