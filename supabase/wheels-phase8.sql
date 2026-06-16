-- ============================================================================
--  SC Wheels — Phase 8 migration  (Worker Job Ticket v1)
--
--  EXTENDS the Phase 7 wheels_production_tickets table with a worker EXECUTION
--  lifecycle, separate from the office-review `status` column. ADDITIVE ONLY;
--  no duplicate ticket system. Run after phase1..7. Idempotent.
--
--  work_status is the factory-floor status (waiting → in_progress → done) and is
--  ORTHOGONAL to the office `status` (open/in_review/accepted/...). Progressing a
--  job ticket is communication/visibility ONLY — it never deducts stock, creates
--  production transactions, touches BOM, sales, or the Work Plan.
-- ============================================================================

alter table public.wheels_production_tickets
  add column if not exists work_status text not null default 'waiting',   -- waiting | in_progress | done
  add column if not exists started_at  timestamptz,
  add column if not exists started_by  text,
  add column if not exists finished_at timestamptz,
  add column if not exists finished_by text;

create index if not exists wheels_tickets_work_idx on public.wheels_production_tickets (work_status, started_at);

-- RLS unchanged (admin_all from phase 7). Worker-side start/finish go through the
-- service role (server actions), as with production submission.
