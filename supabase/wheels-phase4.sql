-- ============================================================================
--  SC Wheels — Phase 4 migration  (Worker Roles & Function Access)
--
--  Adds one-role-per-worker access control for the SC Wheels worker area only.
--  ADDITIVE: does not redesign worker auth or any SC Inventory table.
--  Run once in the Supabase SQL editor after phase1/2/3. Idempotent.
--
--  Rules baked in:
--   - A protected system role 'general' (is_system) exists and is the default.
--   - "Function availability" model: a function with NO role mapping is open to
--     ALL workers (default-open). Mapping rows restrict a function to roles.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  Worker roles (one per worker). 'general' is the protected system default.
-- ---------------------------------------------------------------------------
create table if not exists public.worker_roles (
  id         text primary key,           -- slug, e.g. 'general', 'packer'
  name       text not null,              -- Thai label
  name_en    text,
  sort       int  not null default 0,
  active     boolean not null default true,
  is_system  boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.worker_roles (id, name, name_en, sort, active, is_system)
values ('general', 'ทั่วไป', 'General', 0, true, true)
on conflict (id) do update set is_system = true, active = true;

-- ---------------------------------------------------------------------------
--  workers.role_id — one role per worker. Existing workers get the default.
-- ---------------------------------------------------------------------------
alter table public.workers
  add column if not exists role_id text references public.worker_roles(id) on delete set null;
update public.workers set role_id = 'general' where role_id is null;

-- ---------------------------------------------------------------------------
--  Function → role access (SC Wheels worker functions). function_key values are
--  immutable internal identifiers defined in lib/wheels/worker-functions.ts.
--  EMPTY for a function = open to all (default-open).
-- ---------------------------------------------------------------------------
create table if not exists public.wheels_function_roles (
  function_key text not null,
  role_id      text not null references public.worker_roles(id) on delete cascade,
  primary key (function_key, role_id)
);

-- ---------------------------------------------------------------------------
--  RLS — authenticated admin full access (same model as schema.sql).
-- ---------------------------------------------------------------------------
do $do$
declare t text;
begin
  foreach t in array array['worker_roles', 'wheels_function_roles']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists admin_all on public.%I;', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (true) with check (true);', t);
  end loop;
end $do$;
