import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { WheelAssembly, WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import type { WheelCrate } from "@/lib/wheels/crate";
import { approxPieces } from "@/lib/wheels/crate";
import { rawWheelLabel } from "@/lib/wheels/sku";
import { groupBoxes, flattenGroups, grooveLabel, sizeLabel } from "@/lib/wheels/grouping";
import type { WorkPlanItem } from "@/lib/wheels/work-plan";
import type { PlanProduct, LowStockSize, SkuContext } from "@/components/wheels/work-plan-client";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type WorkPlanView = {
  items: WorkPlanItem[];
  products: PlanProduct[];
  contextById: Record<string, SkuContext>;
  lowStock: LowStockSize[];
  today: string;
  tomorrow: string;
};

/**
 * Single source of truth for the Work Plan screen's data — shared by the admin
 * console page and the worker-side (read-only) page so the business view is
 * identical and never duplicated. Pass whichever Supabase client the caller has
 * (admin auth client, or worker service client). Read-only; no mutations.
 */
export async function loadWorkPlanView(supabase: SupabaseClient): Promise<WorkPlanView> {
  const today = new Date().toISOString().slice(0, 10);
  const tmr = new Date(`${today}T00:00:00Z`);
  tmr.setUTCDate(tmr.getUTCDate() + 1);
  const tomorrow = tmr.toISOString().slice(0, 10);

  const [items, boxes, assemblies, raw, finishes, sizes, grooves, crates] = await Promise.all([
    supabase.from("wheels_work_plan_items").select("*").in("plan_date", [today, tomorrow]).order("created_at"),
    // Not-archived (incl. inactive) so plan rows for a since-deactivated SKU still resolve context.
    supabase.from("wheels_boxes").select("*").eq("archived", false).order("display_order"),
    supabase.from("wheels_assemblies").select("*").eq("archived", false).order("display_order"),
    supabase.from("wheels_raw").select("*"),
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
    supabase.from("wheels_crates").select("*").eq("active", true),
  ]);

  const rawById = new Map(((raw.data ?? []) as WheelRaw[]).map((r) => [r.id, r]));
  const fin = (finishes.data ?? []) as WheelLookup[];
  const siz = (sizes.data ?? []) as WheelLookup[];
  const grv = (grooves.data ?? []) as WheelLookup[];
  const crateByRaw = new Map(((crates.data ?? []) as WheelCrate[]).map((c) => [c.raw_id, c]));

  const allBoxes = (boxes.data ?? []) as WheelBox[];
  const allAssemblies = (assemblies.data ?? []) as WheelAssembly[];

  const crateFor = (rawId: string | undefined): SkuContext["crate"] => {
    const c = rawId ? crateByRaw.get(rawId) : undefined;
    return c ? { crates: c.crate_qty, piecesPerCrate: c.pieces_per_crate, approxPieces: approxPieces(c) } : null;
  };
  const ctxOf = (stock: number, minStock: number, crate: SkuContext["crate"]): SkuContext => ({
    stock,
    minStock,
    shortage: Math.max(0, minStock - stock),
    crate,
  });

  // Per-item context map (keyed by product_id) — covers every box/assembly,
  // active or not, so completed/older plan rows still show context.
  const contextById: Record<string, SkuContext> = {};
  for (const b of allBoxes) contextById[b.id] = ctxOf(b.stock, b.min_stock, crateFor(b.raw_id));
  for (const a of allAssemblies) contextById[a.id] = ctxOf(a.stock, a.min_stock, null);

  // Product picker (active boxes in canonical order + active assemblies), with context.
  const orderedBoxes = flattenGroups(groupBoxes(allBoxes.filter((b) => b.active), rawById, fin, siz, grv));
  const products: PlanProduct[] = [
    ...orderedBoxes.map((b) => {
      const r = rawById.get(b.raw_id);
      return {
        kind: "box" as const,
        id: b.id,
        sku: b.sku,
        name: r ? rawWheelLabel(r, fin, siz, grv) : b.sku,
        unit: b.unit,
        stock: b.stock,
        minStock: b.min_stock,
        crate: crateFor(b.raw_id),
      };
    }),
    ...allAssemblies
      .filter((a) => a.active)
      .map((a) => ({
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

  // Low Stock picker: active packed boxes below their minimum, grouped Size → Groove.
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

  return { items: (items.data ?? []) as WorkPlanItem[], products, contextById, lowStock, today, tomorrow };
}
