import { createClient } from "@/lib/supabase/server";
import type { WheelAssembly, WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import type { WheelCrate } from "@/lib/wheels/crate";
import { approxPieces } from "@/lib/wheels/crate";
import { rawWheelLabel } from "@/lib/wheels/sku";
import { groupBoxes, flattenGroups, grooveLabel, sizeLabel } from "@/lib/wheels/grouping";
import type { WorkPlanItem } from "@/lib/wheels/work-plan";
import { WorkPlanClient, type PlanProduct, type LowStockSize } from "@/components/wheels/work-plan-client";

/**
 * SC Wheels — Work Plan v1 (Phase 5) + Phase 6 passive context. Owner/admin record
 * what the factory should focus on Today / Tomorrow; everyone sees the same intent.
 * INFORMATION ONLY — never affects stock, transactions, production or sales.
 *
 * Phase 6 additions (passive visibility only, no automation):
 *   - product context (current/min stock, shortage, wooden-crate availability)
 *   - a Low Stock SKU picker grouped Size → Groove to help build the plan
 */
export default async function WorkPlanPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const tmr = new Date(`${today}T00:00:00Z`);
  tmr.setUTCDate(tmr.getUTCDate() + 1);
  const tomorrow = tmr.toISOString().slice(0, 10);

  const [items, boxes, assemblies, raw, finishes, sizes, grooves, crates] = await Promise.all([
    supabase.from("wheels_work_plan_items").select("*").in("plan_date", [today, tomorrow]).order("created_at"),
    supabase.from("wheels_boxes").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_assemblies").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_raw").select("*"),
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
    // Crate inventory (Phase 6). If the table isn't migrated yet, data is null → no crate context.
    supabase.from("wheels_crates").select("*").eq("active", true),
  ]);

  const rawById = new Map(((raw.data ?? []) as WheelRaw[]).map((r) => [r.id, r]));
  const fin = (finishes.data ?? []) as WheelLookup[];
  const siz = (sizes.data ?? []) as WheelLookup[];
  const grv = (grooves.data ?? []) as WheelLookup[];
  const crateByRaw = new Map(((crates.data ?? []) as WheelCrate[]).map((c) => [c.raw_id, c]));

  // Product picker (boxes in canonical order + assemblies), each with passive context.
  const orderedBoxes = flattenGroups(groupBoxes((boxes.data ?? []) as WheelBox[], rawById, fin, siz, grv));
  const products: PlanProduct[] = [
    ...orderedBoxes.map((b) => {
      const r = rawById.get(b.raw_id);
      const crate = r ? crateByRaw.get(r.id) : undefined;
      return {
        kind: "box" as const,
        id: b.id,
        sku: b.sku,
        name: r ? rawWheelLabel(r, fin, siz, grv) : b.sku,
        unit: b.unit,
        stock: b.stock,
        minStock: b.min_stock,
        crate: crate ? { crates: crate.crate_qty, piecesPerCrate: crate.pieces_per_crate, approxPieces: approxPieces(crate) } : null,
      };
    }),
    ...((assemblies.data ?? []) as WheelAssembly[]).map((a) => ({
      kind: "assembly" as const,
      id: a.id,
      sku: a.sku,
      name: a.name,
      unit: a.unit,
      stock: a.stock,
      minStock: a.min_stock,
      crate: null,
    })),
  ];

  // Low Stock picker: packed boxes below their minimum, grouped Size → Groove.
  // Passive list only — no auto-select, no suggested quantities, no ranking.
  const lowBoxes = orderedBoxes.filter((b) => b.min_stock > 0 && b.stock < b.min_stock);
  const sizeMap = new Map<string, Map<string, LowStockSize["grooves"][number]["items"]>>();
  for (const b of lowBoxes) {
    const r = rawById.get(b.raw_id);
    if (!r) continue;
    let gMap = sizeMap.get(r.size);
    if (!gMap) {
      gMap = new Map();
      sizeMap.set(r.size, gMap);
    }
    const arr = gMap.get(r.groove) ?? [];
    arr.push({
      product_id: b.id,
      sku: b.sku,
      name: rawWheelLabel(r, fin, siz, grv),
      unit: b.unit,
      stock: b.stock,
      minStock: b.min_stock,
      shortage: b.min_stock - b.stock,
    });
    gMap.set(r.groove, arr);
  }
  const sortOf = (rows: WheelLookup[], id: string) => rows.find((x) => x.id === id)?.sort ?? 9999;
  const lowStock: LowStockSize[] = Array.from(sizeMap.entries())
    .sort(([a], [b]) => sortOf(siz, a) - sortOf(siz, b))
    .map(([sizeId, gMap]) => ({
      sizeId,
      sizeLabel: sizeLabel(siz, sizeId),
      grooves: Array.from(gMap.entries())
        .sort(([a], [b]) => sortOf(grv, a) - sortOf(grv, b))
        .map(([grooveId, items]) => ({ grooveId, grooveLabel: grooveLabel(grv, grooveId), items })),
    }));

  return (
    <WorkPlanClient
      items={(items.data ?? []) as WorkPlanItem[]}
      products={products}
      lowStock={lowStock}
      today={today}
      tomorrow={tomorrow}
    />
  );
}
