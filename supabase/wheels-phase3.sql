-- ============================================================================
--  SC Wheels — Phase 3 foundation migration  (Grouping & Terminology)
--
--  Establishes the canonical product terminology used by the system-wide
--  Version → Size → Groove hierarchy. ADDITIVE + a one-time data migration of
--  existing rows. Run once in the Supabase SQL editor AFTER phase1/2.
--  Re-runnable (idempotent): the remap updates are no-ops once applied.
--
--  Does NOT change Phase 1/2 tables, RPCs, or SC Inventory.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1) Groove terminology → U / V / W (one canonical set; no dual naming).
--     Round → U, Angle → V, Double → W. FK-safe order: add new, remap children,
--     then drop the old values.
-- ---------------------------------------------------------------------------
insert into public.wheels_grooves (id, th, en, sort) values
  ('u', 'ร่อง U', 'U', 1),
  ('v', 'ร่อง V', 'V', 2),
  ('w', 'ร่อง W', 'W', 3)
on conflict (id) do update set th = excluded.th, en = excluded.en, sort = excluded.sort;

update public.wheels_raw set groove = 'u' where groove = 'round';
update public.wheels_raw set groove = 'v' where groove = 'angle';
update public.wheels_raw set groove = 'w' where groove = 'double';

delete from public.wheels_grooves where id in ('round', 'angle', 'double');

-- ---------------------------------------------------------------------------
--  2) Version (wheels_finishes is the extensible "version/series" lookup).
--     Relabel the seeded defaults; keep ids (chrome/zinc) so SKU prefixes stay
--     CHR/ZIN. New versions (Nylon, Stainless, …) are added by the user via the
--     /admin/wheels/attributes screen — no migration needed.
-- ---------------------------------------------------------------------------
update public.wheels_finishes set th = 'โครเมียม',  en = 'Chromium',     sort = 1 where id = 'chrome';
update public.wheels_finishes set th = 'ชุบซิงค์',    en = 'Zinc-Plating', sort = 2 where id = 'zinc';
