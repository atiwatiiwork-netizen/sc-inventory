-- ============================================================================
--  SC Wheels — Phase 1 migration  (Foundation + Wheel Catalog)
--
--  A new MAKE-TO-STOCK manufacturing module living inside the SC Inventory app.
--  This migration adds ONLY the SC Wheels catalog — it does NOT touch any
--  existing SC Inventory table. Run it once in the Supabase SQL editor (after
--  schema.sql) on a new or existing database.
--
--  Three product layers are modelled as SEPARATE entities (not one universal SKU):
--    1. wheels_raw        — raw wheel SKU: finish × size × groove
--    2. wheels_boxes      — packed box SKU: references a raw wheel + units/box
--    3. wheels_assemblies — finished assembly product, defined via a BOM
--                           (wheels_assembly_bom)
--
--  Movement flows (worker production IN / office sales OUT), finished-goods
--  inventory, dashboard, reports and LINE are LATER phases and are intentionally
--  NOT created here.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
--  Attribute lookups — extensible like report_units, so adding a new finish /
--  size / groove never needs a schema change.
-- ---------------------------------------------------------------------------
create table if not exists public.wheels_finishes (
  id   text primary key,           -- 'chrome' | 'zinc'
  th   text not null,
  en   text not null,
  sort int  not null default 0
);

create table if not exists public.wheels_sizes (
  id   text primary key,           -- '2"' | '2.5"' | '3"' | '3-thick' | '4"'
  th   text not null,
  en   text not null,
  sort int  not null default 0
);

create table if not exists public.wheels_grooves (
  id   text primary key,           -- 'round' | 'angle' | 'double'
  th   text not null,
  en   text not null,
  sort int  not null default 0
);

-- ---------------------------------------------------------------------------
--  1) Raw wheel SKUs — a raw wheel is uniquely defined by finish × size × groove.
-- ---------------------------------------------------------------------------
create table if not exists public.wheels_raw (
  id            uuid primary key default gen_random_uuid(),
  sku           text not null unique,
  name          text,                                            -- optional display name
  finish        text not null references public.wheels_finishes(id),
  size          text not null references public.wheels_sizes(id),
  groove        text not null references public.wheels_grooves(id),
  unit          text not null default 'ลูก',                     -- base unit (pieces)
  min_stock     int  not null default 0,                         -- forward-compat (low-stock, later phase)
  display_order int  not null default 0,
  active        boolean not null default true,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (finish, size, groove)
);

-- ---------------------------------------------------------------------------
--  2) Packed box SKUs — a box packs N units of one raw wheel (default 50).
-- ---------------------------------------------------------------------------
create table if not exists public.wheels_boxes (
  id            uuid primary key default gen_random_uuid(),
  sku           text not null unique,
  name          text,
  raw_id        uuid not null references public.wheels_raw(id),
  units_per_box int  not null default 50,
  unit          text not null default 'กล่อง',
  min_stock     int  not null default 0,
  display_order int  not null default 0,
  active        boolean not null default true,
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists wheels_boxes_raw_idx on public.wheels_boxes (raw_id);

-- ---------------------------------------------------------------------------
--  3) Assembly products — finished goods defined through a BOM.
-- ---------------------------------------------------------------------------
create table if not exists public.wheels_assemblies (
  id            uuid primary key default gen_random_uuid(),
  sku           text not null unique,
  name          text not null,
  name_en       text,
  unit          text not null default 'ชิ้น',
  min_stock     int  not null default 0,
  display_order int  not null default 0,
  active        boolean not null default true,
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- BOM lines — each line is a raw wheel, a packed box, or a free-text part.
create table if not exists public.wheels_assembly_bom (
  id             uuid primary key default gen_random_uuid(),
  assembly_id    uuid not null references public.wheels_assemblies(id) on delete cascade,
  component_type text not null,                                  -- 'raw' | 'box' | 'part'
  raw_id         uuid references public.wheels_raw(id),
  box_id         uuid references public.wheels_boxes(id),
  part_name      text,                                           -- when component_type = 'part'
  qty            numeric not null,
  unit           text,
  sort           int not null default 0
);
create index if not exists wheels_bom_assembly_idx on public.wheels_assembly_bom (assembly_id);

-- ---------------------------------------------------------------------------
--  Seed the attribute lookups (idempotent).
-- ---------------------------------------------------------------------------
insert into public.wheels_finishes (id, th, en, sort) values
  ('chrome', 'ชุบโครเมียม', 'Chrome', 1),
  ('zinc',   'ชุบซิงค์',     'Zinc',   2)
on conflict (id) do nothing;

insert into public.wheels_sizes (id, th, en, sort) values
  ('2',       '2 นิ้ว',        '2"',        1),
  ('2.5',     '2.5 นิ้ว',      '2.5"',      2),
  ('3',       '3 นิ้ว',        '3"',        3),
  ('3-thick', '3 นิ้ว หนา',    '3" Thick',  4),
  ('4',       '4 นิ้ว',        '4"',        5)
on conflict (id) do nothing;

insert into public.wheels_grooves (id, th, en, sort) values
  ('round',  'ร่องกลม',  'Round',  1),
  ('angle',  'ร่องเหลี่ยม', 'Angle', 2),
  ('double', 'ร่องคู่',   'Double', 3)
on conflict (id) do nothing;

-- ===========================================================================
--  Row-level security — identical model to schema.sql: authenticated = admin
--  = full access. SC Wheels Phase 1 has no worker/service paths.
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'wheels_finishes','wheels_sizes','wheels_grooves',
    'wheels_raw','wheels_boxes','wheels_assemblies','wheels_assembly_bom'
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
