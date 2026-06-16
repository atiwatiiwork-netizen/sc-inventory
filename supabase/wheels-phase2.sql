-- ============================================================================
--  SC Wheels — Phase 2 migration  (Production & Sales Movement Model)
--
--  Adds the movement engine on top of the Phase 1 catalog. ADDITIVE ONLY:
--  it does not alter any Phase 1 column/semantics, nor any SC Inventory table.
--  Run once in the Supabase SQL editor AFTER wheels-phase1.sql.
--
--  Three independent inventory layers, each with its own balance:
--    raw   : IN = supplier receiving (office/admin)
--            OUT = auto-consumed by packing & assembly · rare direct raw sale (admin)
--    box   : IN = packing (worker)   OUT = sale (office) · auto-consumed by assembly BOM
--    assembly: IN = assembly (worker) OUT = sale (office)
--
--  Locked rules: workers enter finished outputs only; office enters sales only;
--  the system calculates every consumption (units_per_box / BOM) automatically;
--  shortages are soft-blocked and only an admin can override, with a required
--  reason recorded in wheels_overrides + audit_log.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  Per-layer stock balances (mirrors products.stock).
-- ---------------------------------------------------------------------------
alter table public.wheels_raw        add column if not exists stock int not null default 0;
alter table public.wheels_boxes      add column if not exists stock int not null default 0;
alter table public.wheels_assemblies add column if not exists stock int not null default 0;

-- ---------------------------------------------------------------------------
--  Unified movement ledger (one source of truth for every layer).
-- ---------------------------------------------------------------------------
create table if not exists public.wheels_transactions (
  id          uuid primary key default gen_random_uuid(),
  txn_date    date not null default current_date,
  layer       text not null,            -- 'raw' | 'box' | 'assembly'
  ref_id      uuid not null,            -- the SKU id in that layer
  type        text not null,            -- 'receive'|'pack_in'|'assemble_in'|'consume'|'sale'
  qty         int  not null,            -- signed: + in, - out
  source_kind text not null,            -- 'receiving' | 'production' | 'sale'
  source_id   uuid,                     -- event header id (trace / reversal)
  prod_kind   text,                     -- production rows only: 'pack' | 'assemble'
  override_id uuid,                     -- set when this deduction was admin-overridden
  note        text,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists wheels_txn_source_idx on public.wheels_transactions (source_kind, source_id);
create index if not exists wheels_txn_layer_idx  on public.wheels_transactions (layer, ref_id);

-- ---------------------------------------------------------------------------
--  Worker production — one header per (worker, day); packing & assembly are
--  separate workflows that each merge only their own 'kind' of items.
-- ---------------------------------------------------------------------------
create table if not exists public.wheels_production (
  id           uuid primary key default gen_random_uuid(),
  worker_id    uuid references public.workers(id),
  prod_date    date not null,
  status       text not null default 'submitted',
  submitted_at timestamptz not null default now(),
  unique (worker_id, prod_date)
);

create table if not exists public.wheels_production_items (
  id            uuid primary key default gen_random_uuid(),
  production_id uuid references public.wheels_production(id) on delete cascade,
  kind          text not null,          -- 'pack' | 'assemble'
  box_id        uuid references public.wheels_boxes(id),
  assembly_id   uuid references public.wheels_assemblies(id),
  qty           int not null
);

-- ---------------------------------------------------------------------------
--  Office sales (batch, voidable). customer is OPTIONAL.
--  is_raw_exception flags the admin-only direct raw-wheel sale.
-- ---------------------------------------------------------------------------
create table if not exists public.wheels_sales (
  id               uuid primary key default gen_random_uuid(),
  sale_date        date not null default current_date,
  customer         text,
  note             text,
  is_raw_exception boolean not null default false,
  voided           boolean not null default false,
  created_by       text,
  created_at       timestamptz not null default now()
);

create table if not exists public.wheels_sale_items (
  id      uuid primary key default gen_random_uuid(),
  sale_id uuid references public.wheels_sales(id) on delete cascade,
  layer   text not null,                -- 'box' | 'assembly' | 'raw'(exception)
  ref_id  uuid not null,
  qty     int  not null
);

-- ---------------------------------------------------------------------------
--  Admin override audit — reason is REQUIRED.
-- ---------------------------------------------------------------------------
create table if not exists public.wheels_overrides (
  id          uuid primary key default gen_random_uuid(),
  approved_by text not null,
  layer       text not null,
  ref_id      uuid not null,
  shortage    int  not null,
  source_kind text not null,
  source_id   uuid,
  reason      text not null,
  created_at  timestamptz not null default now()
);

-- ===========================================================================
--  Internal helpers
-- ===========================================================================
create or replace function public._wheels_bal(p_layer text, p_ref uuid, p_delta int)
returns void language plpgsql security definer set search_path = public as $bal$
begin
  if    p_layer = 'raw'      then update public.wheels_raw        set stock = stock + p_delta where id = p_ref;
  elsif p_layer = 'box'      then update public.wheels_boxes      set stock = stock + p_delta where id = p_ref;
  elsif p_layer = 'assembly' then update public.wheels_assemblies set stock = stock + p_delta where id = p_ref;
  else  raise exception 'unknown layer %', p_layer;
  end if;
end; $bal$;

create or replace function public._wheels_stock(p_layer text, p_ref uuid)
returns int language sql security definer set search_path = public as $stk$
  select case p_layer
    when 'raw'      then (select stock from public.wheels_raw        where id = p_ref)
    when 'box'      then (select stock from public.wheels_boxes      where id = p_ref)
    when 'assembly' then (select stock from public.wheels_assemblies where id = p_ref)
  end;
$stk$;

create or replace function public._wheels_sku(p_layer text, p_ref uuid)
returns text language sql security definer set search_path = public as $sku$
  select case p_layer
    when 'raw'      then (select sku from public.wheels_raw        where id = p_ref)
    when 'box'      then (select sku from public.wheels_boxes      where id = p_ref)
    when 'assembly' then (select sku from public.wheels_assemblies where id = p_ref)
  end;
$sku$;

-- ===========================================================================
--  RPC: raw receiving (office/admin) — +raw, ledger 'receive'. No shortage risk.
--  p_lines: [{ "raw_id": uuid, "qty": int }]
-- ===========================================================================
create or replace function public.wheels_receive_raw(
  p_date date, p_note text, p_by text, p_lines jsonb
) returns int
language plpgsql security definer set search_path = public as $recv$
declare line jsonb; rid uuid; n int; cnt int := 0;
begin
  for line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    rid := (line->>'raw_id')::uuid;
    n   := (line->>'qty')::int;
    if rid is null or n is null or n = 0 then continue; end if;
    insert into public.wheels_transactions(txn_date, layer, ref_id, type, qty, source_kind, note, created_by)
    values (p_date, 'raw', rid, 'receive', n, 'receiving', nullif(p_note,''), coalesce(p_by,'admin'));
    perform public._wheels_bal('raw', rid, n);
    cnt := cnt + 1;
  end loop;
  insert into public.audit_log(who, action, detail)
  values (coalesce(p_by,'admin'), 'รับล้อดิบเข้า (SC Wheels)', format('%s รายการ · วันที่ %s', cnt, p_date));
  return cnt;
end; $recv$;

-- ===========================================================================
--  RPC: worker production for ONE kind ('pack' or 'assemble').
--  Validates shortages against the balance AFTER reversing this kind's prior
--  submission (re-submit = edit). Returns jsonb:
--    { "status":"ok", "production_id":uuid }
--    { "status":"shortage", "shortages":[{layer,ref_id,sku,have,need,short}] }
--  p_items: pack → [{box_id, qty}] ; assemble → [{assembly_id, qty}]
-- ===========================================================================
create or replace function public.wheels_submit_production(
  p_worker uuid, p_date date, p_kind text, p_no_production boolean,
  p_items jsonb, p_override boolean default false,
  p_override_by text default null, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $prod$
declare
  prod_id uuid;
  w_code  text;
  v_short jsonb;
  rec     record;
  item    jsonb;
  ov_id   uuid;
begin
  if p_kind not in ('pack','assemble') then raise exception 'bad kind %', p_kind; end if;
  if p_override and coalesce(btrim(p_reason),'') = '' then
    raise exception 'override requires a reason';
  end if;
  select code into w_code from public.workers where id = p_worker;
  select id into prod_id from public.wheels_production where worker_id = p_worker and prod_date = p_date;

  -- Proposed input consumption for THIS submission, aggregated per (layer, ref).
  drop table if exists _consume;
  create temporary table _consume on commit drop as
  with pack as (
    select 'raw'::text as layer, b.raw_id as ref_id,
           sum((it->>'qty')::int * b.units_per_box)::int as amt
    from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) it
    join public.wheels_boxes b on b.id = (it->>'box_id')::uuid
    where p_kind = 'pack' and not coalesce(p_no_production,false)
    group by b.raw_id
  ),
  asm as (
    select case when bom.component_type = 'raw' then 'raw' else 'box' end as layer,
           coalesce(bom.raw_id, bom.box_id) as ref_id,
           sum((it->>'qty')::int * bom.qty)::int as amt
    from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) it
    join public.wheels_assembly_bom bom on bom.assembly_id = (it->>'assembly_id')::uuid
    where p_kind = 'assemble' and not coalesce(p_no_production,false)
      and bom.component_type in ('raw','box')
    group by 1, 2
  )
  select layer, ref_id, sum(amt)::int as amt
  from (select * from pack union all select * from asm) u
  group by layer, ref_id;

  -- Shortages = consumes exceeding the balance that would exist AFTER reversing
  -- this kind's prior rows (effective = current stock − prior kind delta).
  select coalesce(jsonb_agg(s), '[]'::jsonb) into v_short from (
    select jsonb_build_object(
             'layer', c.layer, 'ref_id', c.ref_id,
             'sku',  public._wheels_sku(c.layer, c.ref_id),
             'have', eff.bal, 'need', c.amt, 'short', c.amt - eff.bal) as s
    from _consume c
    cross join lateral (
      select public._wheels_stock(c.layer, c.ref_id)
             - coalesce((select sum(qty) from public.wheels_transactions
                         where source_kind='production' and source_id = prod_id
                           and prod_kind = p_kind and layer = c.layer and ref_id = c.ref_id), 0) as bal
    ) eff
    where c.amt > eff.bal
  ) q;

  if jsonb_array_length(v_short) > 0 and not coalesce(p_override,false) then
    return jsonb_build_object('status','shortage','shortages', v_short);  -- nothing mutated
  end if;

  -- Commit. Create header if first submission of the day.
  if prod_id is null then
    insert into public.wheels_production(worker_id, prod_date) values (p_worker, p_date) returning id into prod_id;
  else
    update public.wheels_production set submitted_at = now() where id = prod_id;
  end if;

  -- Reverse this kind's prior effect, then clear its rows/items.
  for rec in select layer, ref_id, qty from public.wheels_transactions
             where source_kind='production' and source_id = prod_id and prod_kind = p_kind loop
    perform public._wheels_bal(rec.layer, rec.ref_id, -rec.qty);
  end loop;
  delete from public.wheels_transactions where source_kind='production' and source_id = prod_id and prod_kind = p_kind;
  delete from public.wheels_production_items where production_id = prod_id and kind = p_kind;

  -- Record overrides (admin only) — one per shorted layer.
  if jsonb_array_length(v_short) > 0 and coalesce(p_override,false) then
    for rec in select * from jsonb_to_recordset(v_short) as x(layer text, ref_id uuid, sku text, have int, need int, short int) loop
      insert into public.wheels_overrides(approved_by, layer, ref_id, shortage, source_kind, source_id, reason)
      values (coalesce(p_override_by,'admin'), rec.layer, rec.ref_id, rec.short, 'production', prod_id, p_reason)
      returning id into ov_id;
      insert into public.audit_log(who, action, detail)
      values (coalesce(p_override_by,'admin'), 'ข้ามคำเตือนสต็อกติดลบ (override)',
              format('%s %s · ขาด %s · เหตุผล: %s', rec.layer, rec.sku, rec.short, p_reason));
    end loop;
  end if;

  if not coalesce(p_no_production,false) then
    -- Outputs (+) + items.
    for item in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
      if (item->>'qty') is null or (item->>'qty')::int = 0 then continue; end if;
      if p_kind = 'pack' then
        insert into public.wheels_production_items(production_id, kind, box_id, qty)
        values (prod_id, 'pack', (item->>'box_id')::uuid, (item->>'qty')::int);
        insert into public.wheels_transactions(txn_date, layer, ref_id, type, qty, source_kind, source_id, prod_kind, created_by)
        values (p_date, 'box', (item->>'box_id')::uuid, 'pack_in', (item->>'qty')::int, 'production', prod_id, 'pack', coalesce(w_code,'worker'));
      else
        insert into public.wheels_production_items(production_id, kind, assembly_id, qty)
        values (prod_id, 'assemble', (item->>'assembly_id')::uuid, (item->>'qty')::int);
        insert into public.wheels_transactions(txn_date, layer, ref_id, type, qty, source_kind, source_id, prod_kind, created_by)
        values (p_date, 'assembly', (item->>'assembly_id')::uuid, 'assemble_in', (item->>'qty')::int, 'production', prod_id, 'assemble', coalesce(w_code,'worker'));
      end if;
    end loop;

    -- Inputs (−) from the aggregated consume set.
    for rec in select layer, ref_id, amt from _consume loop
      select id into ov_id from public.wheels_overrides
        where source_kind='production' and source_id = prod_id and layer = rec.layer and ref_id = rec.ref_id
        order by created_at desc limit 1;
      insert into public.wheels_transactions(txn_date, layer, ref_id, type, qty, source_kind, source_id, prod_kind, override_id, created_by, note)
      values (p_date, rec.layer, rec.ref_id, 'consume', -rec.amt, 'production', prod_id, p_kind, ov_id, coalesce(w_code,'worker'), 'auto-deduct');
      perform public._wheels_bal(rec.layer, rec.ref_id, -rec.amt);
    end loop;

    -- Apply outputs to balances.
    for item in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
      if (item->>'qty') is null or (item->>'qty')::int = 0 then continue; end if;
      if p_kind = 'pack' then perform public._wheels_bal('box', (item->>'box_id')::uuid, (item->>'qty')::int);
      else perform public._wheels_bal('assembly', (item->>'assembly_id')::uuid, (item->>'qty')::int);
      end if;
    end loop;
  end if;

  insert into public.audit_log(who, action, detail)
  values (coalesce(w_code,'worker'),
          case when p_kind = 'pack' then 'บันทึกการแพ็ค (SC Wheels)' else 'บันทึกการประกอบ (SC Wheels)' end,
          format('วันที่ %s · %s', p_date,
                 case when coalesce(p_no_production,false) then 'ไม่มีการผลิต'
                      else jsonb_array_length(coalesce(p_items,'[]'::jsonb)) || ' รายการ' end));

  return jsonb_build_object('status','ok','production_id', prod_id);
end; $prod$;

-- ===========================================================================
--  RPC: office sale (box/assembly; raw only when p_allow_raw, admin path).
--  Same shortage/override discipline. Returns jsonb like production.
--  p_items: [{ "layer":'box'|'assembly'|'raw', "ref_id":uuid, "qty":int }]
-- ===========================================================================
create or replace function public.wheels_record_sale(
  p_by text, p_date date, p_customer text, p_note text, p_items jsonb,
  p_allow_raw boolean default false, p_override boolean default false,
  p_override_by text default null, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $sale$
declare
  sale_id uuid;
  v_short jsonb;
  rec     record;
  item    jsonb;
  ov_id   uuid;
  bad     int;
begin
  if p_override and coalesce(btrim(p_reason),'') = '' then
    raise exception 'override requires a reason';
  end if;

  -- Layer guard: raw only on the admin exception path.
  select count(*) into bad from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) it
    where (it->>'layer') not in ('box','assembly','raw')
       or ((it->>'layer') = 'raw' and not coalesce(p_allow_raw,false));
  if bad > 0 then raise exception 'invalid sale layer (raw sales are admin-only)'; end if;

  drop table if exists _sell;
  create temporary table _sell on commit drop as
  select (it->>'layer') as layer, (it->>'ref_id')::uuid as ref_id, sum((it->>'qty')::int)::int as amt
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) it
  where (it->>'qty')::int > 0
  group by 1, 2;

  select coalesce(jsonb_agg(s), '[]'::jsonb) into v_short from (
    select jsonb_build_object('layer', s.layer, 'ref_id', s.ref_id, 'sku', public._wheels_sku(s.layer, s.ref_id),
             'have', public._wheels_stock(s.layer, s.ref_id), 'need', s.amt,
             'short', s.amt - public._wheels_stock(s.layer, s.ref_id)) as s
    from _sell s where s.amt > public._wheels_stock(s.layer, s.ref_id)
  ) q;

  if jsonb_array_length(v_short) > 0 and not coalesce(p_override,false) then
    return jsonb_build_object('status','shortage','shortages', v_short);
  end if;

  insert into public.wheels_sales(sale_date, customer, note, is_raw_exception, created_by)
  values (p_date, nullif(btrim(p_customer),''), nullif(p_note,''), coalesce(p_allow_raw,false), coalesce(p_by,'admin'))
  returning id into sale_id;

  if jsonb_array_length(v_short) > 0 and coalesce(p_override,false) then
    for rec in select * from jsonb_to_recordset(v_short) as x(layer text, ref_id uuid, sku text, have int, need int, short int) loop
      insert into public.wheels_overrides(approved_by, layer, ref_id, shortage, source_kind, source_id, reason)
      values (coalesce(p_override_by,'admin'), rec.layer, rec.ref_id, rec.short, 'sale', sale_id, p_reason);
      insert into public.audit_log(who, action, detail)
      values (coalesce(p_override_by,'admin'), 'ข้ามคำเตือนสต็อกติดลบ (override)',
              format('ขาย %s %s · ขาด %s · เหตุผล: %s', rec.layer, rec.sku, rec.short, p_reason));
    end loop;
  end if;

  for rec in select layer, ref_id, amt from _sell loop
    select id into ov_id from public.wheels_overrides
      where source_kind='sale' and source_id = sale_id and layer = rec.layer and ref_id = rec.ref_id
      order by created_at desc limit 1;
    insert into public.wheels_sale_items(sale_id, layer, ref_id, qty) values (sale_id, rec.layer, rec.ref_id, rec.amt);
    insert into public.wheels_transactions(txn_date, layer, ref_id, type, qty, source_kind, source_id, override_id, created_by, note)
    values (p_date, rec.layer, rec.ref_id, 'sale', -rec.amt, 'sale', sale_id, ov_id, coalesce(p_by,'admin'), nullif(btrim(p_customer),''));
    perform public._wheels_bal(rec.layer, rec.ref_id, -rec.amt);
  end loop;

  insert into public.audit_log(who, action, detail)
  values (coalesce(p_by,'admin'),
          case when coalesce(p_allow_raw,false) then 'ขายล้อดิบ พิเศษ (SC Wheels)' else 'บันทึกการขาย (SC Wheels)' end,
          format('วันที่ %s%s · %s', p_date,
                 case when nullif(btrim(p_customer),'') is null then '' else ' · '||p_customer end,
                 (select coalesce(string_agg(public._wheels_sku(layer, ref_id)||' x'||amt, ', '), '0 รายการ') from _sell)));

  return jsonb_build_object('status','ok','sale_id', sale_id);
end; $sale$;

-- ===========================================================================
--  RPC: void a sale (edit/cancel) — reverse its ledger + balances.
-- ===========================================================================
create or replace function public.wheels_void_sale(p_sale_id uuid, p_by text)
returns int language plpgsql security definer set search_path = public as $void$
declare rec record; cnt int := 0;
begin
  for rec in select layer, ref_id, qty from public.wheels_transactions
             where source_kind='sale' and source_id = p_sale_id loop
    perform public._wheels_bal(rec.layer, rec.ref_id, -rec.qty);   -- qty was negative → adds back
    cnt := cnt + 1;
  end loop;
  delete from public.wheels_transactions where source_kind='sale' and source_id = p_sale_id;
  update public.wheels_sales set voided = true where id = p_sale_id;
  insert into public.audit_log(who, action, detail)
  values (coalesce(p_by,'admin'), 'ยกเลิกการขาย (SC Wheels)', format('sale %s · %s รายการ', p_sale_id, cnt));
  return cnt;
end; $void$;

-- ===========================================================================
--  Row-level security — authenticated admin = full access (same as schema.sql).
--  Workers reach production RPCs via the service role (server actions).
-- ===========================================================================
do $do$
declare t text;
begin
  foreach t in array array[
    'wheels_transactions','wheels_production','wheels_production_items',
    'wheels_sales','wheels_sale_items','wheels_overrides'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists admin_all on public.%I;', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (true) with check (true);', t);
  end loop;
end $do$;
