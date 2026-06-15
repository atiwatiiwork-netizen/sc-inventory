-- ============================================================================
--  Optional packaging unit per product: workers count in packs (e.g. มัด, ลัง)
--  but stock/reports stay in the base unit (เส้น, ลูก). pack_size = base units
--  per pack (e.g. 6 เส้น/มัด). Leave null for products counted in the base unit.
--  Run once in the Supabase SQL editor (Run without RLS). Idempotent.
-- ============================================================================
alter table public.products add column if not exists pack_unit text;
alter table public.products add column if not exists pack_size int;
