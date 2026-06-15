-- ============================================================================
--  Worker per-category LINE send + completeness tracking.
--    • submission_category_marks: which (category, customer group) a worker has
--      recorded today (even with zero qty) → know when a category is complete.
--    • category_line_sends: which categories the worker has pushed to LINE today.
--    • submit_daily_usage now records a mark and resets the category's sent flag.
--  Run once in the Supabase SQL editor (Run without RLS). Idempotent.
-- ============================================================================

create table if not exists public.submission_category_marks (
  worker_id         uuid not null,
  usage_date        date not null,
  category_id       text not null,
  customer_group_id text not null,
  marked_at         timestamptz not null default now(),
  primary key (worker_id, usage_date, category_id, customer_group_id)
);

create table if not exists public.category_line_sends (
  worker_id   uuid not null,
  usage_date  date not null,
  category_id text not null,
  sent_at     timestamptz not null default now(),
  primary key (worker_id, usage_date, category_id)
);

do $$
declare t text;
begin
  foreach t in array array['submission_category_marks', 'category_line_sends']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists admin_all on public.%I;', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- replace submit_daily_usage to record the mark + reset the sent flag
create or replace function public.submit_daily_usage(
  p_worker   uuid,
  p_date     date,
  p_group    text,
  p_no_usage boolean,
  p_category text,
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
      where worker_id = p_worker and usage_date = p_date and no_usage = true limit 1;
    if sub_id is null then
      insert into public.daily_submissions(worker_id, usage_date, customer_group_id, no_usage, status)
      values (p_worker, p_date, null, true, 'submitted') returning id into sub_id;
    else
      update public.daily_submissions set submitted_at = now() where id = sub_id;
    end if;
    insert into public.audit_log(who, action, detail)
    values (coalesce(w_code, 'worker'), 'ส่งข้อมูลการใช้ประจำวัน', format('ไม่มีการใช้งาน · วันที่ %s', p_date));
    return sub_id;
  end if;

  select id into sub_id from public.daily_submissions
    where worker_id = p_worker and usage_date = p_date
      and customer_group_id is not distinct from p_group and no_usage = false
    limit 1;
  if sub_id is null then
    insert into public.daily_submissions(worker_id, usage_date, customer_group_id, no_usage, status)
    values (p_worker, p_date, p_group, false, 'submitted') returning id into sub_id;
  else
    update public.daily_submissions set submitted_at = now() where id = sub_id;
  end if;

  for prev in
    select st.product_id, st.qty
    from public.stock_transactions st join public.products p on p.id = st.product_id
    where st.submission_id = sub_id and st.type = 'out' and p.category_id = p_category
  loop
    update public.products set stock = stock - prev.qty where id = prev.product_id;
  end loop;
  delete from public.stock_transactions st using public.products p
    where st.product_id = p.id and st.submission_id = sub_id and st.type = 'out' and p.category_id = p_category;
  delete from public.submission_items si using public.products p
    where si.product_id = p.id and si.submission_id = sub_id and p.category_id = p_category;

  for line in select * from jsonb_array_elements(p_lines)
  loop
    pid := (line->>'product_id')::uuid;
    n   := (line->>'qty')::int;
    if pid is null or n is null or n = 0 then continue; end if;
    insert into public.submission_items(submission_id, product_id, qty) values (sub_id, pid, n);
    insert into public.stock_transactions(txn_date, product_id, type, qty, note, created_by, submission_id)
    values (p_date, pid, 'out', -n, 'การใช้ประจำวัน', coalesce(w_code, 'worker'), sub_id);
    update public.products set stock = stock - n where id = pid;
  end loop;

  insert into public.submission_category_marks(worker_id, usage_date, category_id, customer_group_id)
  values (p_worker, p_date, p_category, p_group)
  on conflict (worker_id, usage_date, category_id, customer_group_id) do update set marked_at = now();
  delete from public.category_line_sends
    where worker_id = p_worker and usage_date = p_date and category_id = p_category;

  insert into public.audit_log(who, action, detail)
  values (coalesce(w_code, 'worker'), 'ส่งข้อมูลการใช้ประจำวัน',
          format('%s · วันที่ %s',
                 coalesce((select name from public.customer_groups where id = p_group), 'ไม่มีการใช้งาน'),
                 p_date));
  return sub_id;
end;
$$;
