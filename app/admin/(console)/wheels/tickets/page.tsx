import { createClient } from "@/lib/supabase/server";
import type { WheelAssembly, WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import type { ProductionTicket } from "@/lib/wheels/ticket";
import { rawWheelLabel } from "@/lib/wheels/sku";
import { groupBoxes, flattenGroups } from "@/lib/wheels/grouping";
import { isLineReady } from "@/lib/wheels/ticket-line";
import { TicketsClient, type PickProduct } from "@/components/wheels/tickets-client";

/**
 * SC Wheels — Production Tickets (Phase 7). Office/head review of production
 * REQUESTS raised from the Stock Ready Check or created manually. List + add
 * pattern. Tickets are decision support only — they never reserve/deduct stock,
 * create production, or touch the Work Plan. All status changes are manual.
 */
export default async function TicketsPage() {
  const supabase = await createClient();

  const [tickets, boxes, assemblies, raw, finishes, sizes, grooves, lineReady] = await Promise.all([
    supabase.from("wheels_production_tickets").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("wheels_boxes").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_assemblies").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_raw").select("*"),
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
    isLineReady(),
  ]);

  const rawById = new Map(((raw.data ?? []) as WheelRaw[]).map((r) => [r.id, r]));
  const fin = (finishes.data ?? []) as WheelLookup[];
  const siz = (sizes.data ?? []) as WheelLookup[];
  const grv = (grooves.data ?? []) as WheelLookup[];

  // Manual-create product picker: boxes (canonical order) + assemblies, with stock/min.
  const orderedBoxes = flattenGroups(groupBoxes((boxes.data ?? []) as WheelBox[], rawById, fin, siz, grv));
  const products: PickProduct[] = [
    ...orderedBoxes.map((b) => {
      const r = rawById.get(b.raw_id);
      return { kind: "box" as const, id: b.id, sku: b.sku, name: r ? rawWheelLabel(r, fin, siz, grv) : b.sku, unit: b.unit, stock: b.stock, minStock: b.min_stock };
    }),
    ...((assemblies.data ?? []) as WheelAssembly[]).map((a) => ({
      kind: "assembly" as const,
      id: a.id,
      sku: a.sku,
      name: a.name,
      unit: a.unit,
      stock: a.stock,
      minStock: a.min_stock,
    })),
  ];

  return (
    <TicketsClient tickets={(tickets.data ?? []) as ProductionTicket[]} products={products} lineReady={lineReady} />
  );
}
