-- ============================================================================
--  Fix: allow a worker to record MULTIPLE customer groups in the same day.
--  Before: unique(worker_id, usage_date) → a 2nd group overwrote the 1st.
--  After:  unique(worker_id, usage_date, customer_group_id) → groups accumulate;
--          re-submitting the same group edits just that group.
--  Run once in the Supabase SQL editor (Run without RLS). Idempotent.
-- ============================================================================

-- swap the uniqueness rule
alter table public.daily_submissions
  drop constraint if exists daily_submissions_worker_id_usage_date_key;

do $$ begin
  alter table public.daily_submissions
    add constraint daily_submissions_worker_date_group_key
    unique (worker_id, usage_date, customer_group_id);
exception when duplicate_object then null; end $$;

-- replace the commit function with group-scoped matching
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
