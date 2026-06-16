import { createClient } from "@/lib/supabase/server";
import type { WheelLookup, WheelRaw } from "@/lib/wheels/types";
import type { WheelCrate, WheelCrateMove } from "@/lib/wheels/crate";
import { rawWheelLabel } from "@/lib/wheels/sku";
import { groupRawWheels, flattenGroups } from "@/lib/wheels/grouping";
import { CratesClient, type CrateRow, type CrateMoveRow } from "@/components/wheels/crates-client";

/**
 * SC Wheels — Wooden Crate Inventory v1 (Phase 6). Passive visibility of how
 * many Chinese wooden crates (each ~2000–2400 raw wheels) are on hand per raw
 * SKU. Maintained MANUALLY; disconnected from the stock movement engine.
 */
export default async function CratesPage() {
  const supabase = await createClient();

  const [crates, raw, finishes, sizes, grooves, moves] = await Promise.all([
    supabase.from("wheels_crates").select("*"),
    supabase.from("wheels_raw").select("*").eq("archived", false),
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
    supabase.from("wheels_crate_moves").select("*").order("created_at", { ascending: false }).limit(30),
  ]);

  const rawById = new Map(((raw.data ?? []) as WheelRaw[]).map((r) => [r.id, r]));
  const fin = (finishes.data ?? []) as WheelLookup[];
  const siz = (sizes.data ?? []) as WheelLookup[];
  const grv = (grooves.data ?? []) as WheelLookup[];
  const crateRows = (crates.data ?? []) as WheelCrate[];
  const crateByRaw = new Map(crateRows.map((c) => [c.raw_id, c]));

  // Crate records ordered by their raw wheel's canonical Version → Size → Groove.
  const orderedRaw = flattenGroups(groupRawWheels((raw.data ?? []) as WheelRaw[], fin, siz, grv));
  const rows: CrateRow[] = orderedRaw
    .filter((r) => crateByRaw.has(r.id))
    .map((r) => {
      const c = crateByRaw.get(r.id)!;
      return {
        id: c.id,
        raw_id: r.id,
        name: rawWheelLabel(r, fin, siz, grv),
        sku: r.sku,
        pieces_per_crate: c.pieces_per_crate,
        crate_qty: c.crate_qty,
        note: c.note,
        active: c.active,
      };
    });

  // Raw wheels available to add (no crate record yet).
  const available = orderedRaw
    .filter((r) => !crateByRaw.has(r.id))
    .map((r) => ({ id: r.id, sku: r.sku, name: rawWheelLabel(r, fin, siz, grv), unit: r.unit }));

  const crateName = (crateId: string) => {
    const c = crateRows.find((x) => x.id === crateId);
    const r = c ? rawById.get(c.raw_id) : undefined;
    return r ? rawWheelLabel(r, fin, siz, grv) : "—";
  };

  const history: CrateMoveRow[] = ((moves.data ?? []) as WheelCrateMove[]).map((m) => ({
    id: m.id,
    name: crateName(m.crate_id),
    delta: m.delta,
    before_qty: m.before_qty,
    after_qty: m.after_qty,
    note: m.note,
    by: m.created_by,
    at: m.created_at,
  }));

  return <CratesClient rows={rows} available={available} history={history} />;
}
