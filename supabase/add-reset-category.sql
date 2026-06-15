-- ============================================================================
--  Reset all products in a category to 0 (testing / bulk fix). Logs each SKU as
--  an adjustment + 'adjust' transaction. Run once (Run without RLS). Idempotent.
-- ============================================================================
create or replace function public.reset_category_stock(p_category text, p_by text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare r record; cnt int := 0;
begin
  for r in select id, stock from public.products where category_id = p_category loop
    if r.stock <> 0 then
      insert into public.adjustments(product_id, system_qty, actual_qty, diff, note, created_by)
      values (r.id, r.stock, 0, -r.stock, 'รีเซ็ตทั้งหมวด', coalesce(p_by, 'admin'));
      insert into public.stock_transactions(product_id, type, qty, note, created_by)
      values (r.id, 'adjust', -r.stock, 'รีเซ็ตทั้งหมวด', coalesce(p_by, 'admin'));
      update public.products set stock = 0 where id = r.id;
      cnt := cnt + 1;
    end if;
  end loop;
  insert into public.audit_log(who, action, detail)
  values (coalesce(p_by, 'admin'), 'รีเซ็ตสต็อกทั้งหมวด', format('%s · %s รายการ', p_category, cnt));
  return cnt;
end;
$$;
