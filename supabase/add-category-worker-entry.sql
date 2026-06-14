-- ============================================================================
--  Add per-category "worker_entry" flag: admin chooses which categories workers
--  must fill in the daily-usage flow (e.g. 6 categories exist, open only 3).
--  Defaults to true so existing categories stay available to workers.
--  Run once in the Supabase SQL editor (Run without RLS). Idempotent.
-- ============================================================================

alter table public.categories
  add column if not exists worker_entry boolean not null default true;
