import { createClient } from "@/lib/supabase/server";
import type { WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { rawWheelLabel } from "@/lib/wheels/sku";
import { groupBoxes, flattenGroups } from "@/lib/wheels/grouping";
import { PILOT_BOX_SKUS, PILOT_LIMIT } from "@/lib/wheels/pilot";
import { StockCheckClient, type StockItem } from "@/components/wheels/stock-check-client";

/**
 * Phase B2 — Stock Reality Check (Pilot). Read-only finished-goods availability
 * for a small set of packed-box SKUs. Answers only: "do we have stock right now?".
 * Reuses the existing box balance (wheels_boxes.stock); no new inventory logic.
 */
export default async function StockCheckPage() {
  const supabase = await createClient();
  const [boxes, raw, finishes, sizes, grooves] = await Promise.all([
    supabase.from("wheels_boxes").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_raw").select("*"),
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
  ]);

  const rawById = new Map(((raw.data ?? []) as WheelRaw[]).map((r) => [r.id, r]));
  const fin = (finishes.data ?? []) as WheelLookup[];
  const siz = (sizes.data ?? []) as WheelLookup[];
  const grv = (grooves.data ?? []) as WheelLookup[];

  // Finished goods, in canonical Version → Size → Groove order.
  const ordered = flattenGroups(groupBoxes((boxes.data ?? []) as WheelBox[], rawById, fin, siz, grv));

  const all: StockItem[] = ordered.map((b) => {
    const r = rawById.get(b.raw_id);
    return {
      sku: b.sku,
      name: r ? rawWheelLabel(r, fin, siz, grv) : b.sku,
      note: b.name ?? null,
      stock: b.stock,
      unit: b.unit,
    };
  });

  // Pilot set: explicit allowlist, else the first N active boxes.
  const items = PILOT_BOX_SKUS.length ? all.filter((i) => PILOT_BOX_SKUS.includes(i.sku)) : all.slice(0, PILOT_LIMIT);

  return <StockCheckClient items={items} />;
}
