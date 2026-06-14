-- ============================================================================
--  SC Inventory Management — Phase 2 migration
--  Run this in the Supabase SQL editor IF you already ran the Phase-1 schema.sql.
--  (A fresh schema.sql already includes everything here.) Idempotent.
--
--  Adds:
--    • stock_transactions.submission_id  (nullable FK → daily_submissions)
--      — used ONLY for worker-generated stock-out transactions (traceability).
--    • receive_stock()       — admin grouped receiving → SKU-level 'in' txns.
--    • submit_daily_usage()  — worker daily usage → submission + mirrored 'out' txns.
-- ============================================================================

-- ---- traceability column + FK ----
alter table public.stock_transactions add column if not exists submission_id uuid;

do $$ begin
  alter table public.stock_transactions
    add constraint stock_transactions_submission_fk
    foreign key (submission_id) references public.daily_submissions(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---- admin grouped receiving → one 'in' transaction per SKU + stock increment ----
create or replace function public.receive_stock(
  p_date date,
  p_note text,
  p_by   text,
  p_lines jsonb            -- [{ "product_id": uuid, "qty": int }, ...]
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

-- ---- worker daily usage → submission + items + mirrored 'out' txns (idempotent) ----
create or replace function public.submit_daily_usage(
  p_worker   uuid,
  p_date     date,
  p_group    text,
  p_no_usage boolean,
  p_lines    jsonb           -- [{ "product_id": uuid, "qty": int }, ...]
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

  select id into sub_id from public.daily_submissions
    where worker_id = p_worker and usage_date = p_date;

  if sub_id is not null then
    for prev in
      select product_id, qty from public.stock_transactions
      where submission_id = sub_id and type = 'out'
    loop
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
