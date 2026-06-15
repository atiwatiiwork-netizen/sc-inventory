-- ============================================================================
--  Stock adjustment (physical count) RPC: writes an adjustments log row, a
--  matching 'adjust' stock transaction, and sets the product's stock to the
--  counted value — all in one transaction. Run once (Run without RLS). Idempotent.
-- ============================================================================
create or replace function public.record_adjustment(
  p_product uuid,
  p_actual  int,
  p_note    text,
  p_by      text
) returns int
language plpgsql
security definer set search_path = public
as $$
declare
  sys int;
  d   int;
begin
  select stock into sys from public.products where id = p_product;
  if sys is null then raise exception 'product not found'; end if;
  d := p_actual - sys;
  insert into public.adjustments(product_id, system_qty, actual_qty, diff, note, created_by)
  values (p_product, sys, p_actual, d, nullif(p_note, ''), coalesce(p_by, 'admin'));
  if d <> 0 then
    insert into public.stock_transactions(product_id, type, qty, note, created_by)
    values (p_product, 'adjust', d, nullif(p_note, ''), coalesce(p_by, 'admin'));
    update public.products set stock = p_actual where id = p_product;
  end if;
  insert into public.audit_log(who, action, detail)
  values (coalesce(p_by, 'admin'), 'ปรับปรุงสต็อก',
          format('%s: %s → %s', (select sku from public.products where id = p_product), sys, p_actual));
  return d;
end;
$$;
