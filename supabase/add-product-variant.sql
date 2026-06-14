-- ============================================================================
--  Add optional product "variant/model" (e.g. GI) used to group worker entry:
--    category → variant → size → length.
--  Existing rails have no variant → they stay in the default group, unchanged.
--  Run once in the Supabase SQL editor (Run without RLS). Idempotent.
-- ============================================================================

alter table public.products add column if not exists variant text;
