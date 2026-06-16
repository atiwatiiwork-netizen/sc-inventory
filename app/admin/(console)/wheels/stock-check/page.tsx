import { createClient } from "@/lib/supabase/server";
import type { WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import type { WheelCrate } from "@/lib/wheels/crate";
import { approxPieces } from "@/lib/wheels/crate";
import { rawWheelLabel, rawWheelLabelTh } from "@/lib/wheels/sku";
import { groupBoxes, flattenGroups } from "@/lib/wheels/grouping";
import { isLineReady } from "@/lib/wheels/ticket-line";
import { createTicket, notifyStockLine } from "@/app/admin/(console)/wheels/tickets/actions";
import { StockReadyCheckClient, type ReadyItem } from "@/components/wheels/stock-ready-check-client";

/**
 * Admin/office Stock Ready Check — same enhanced flow as the worker side:
 * search a finished good, enter a requested quantity, see Green/Yellow/Red, and
 * (on Yellow/Red) optionally raise a production ticket or send a LINE alert.
 * Passive — never reserves or deducts stock. Office/admin may always create
 * tickets here; the ticket/LINE actions are the admin-side server actions.
 */
export default async function StockCheckPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const tmr = new Date(`${today}T00:00:00Z`);
  tmr.setUTCDate(tmr.getUTCDate() + 1);
  const tomorrow = tmr.toISOString().slice(0, 10);

  const [boxes, raw, finishes, sizes, grooves, crates, plan, lineReady] = await Promise.all([
    supabase.from("wheels_boxes").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_raw").select("*"),
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
    supabase.from("wheels_crates").select("*").eq("active", true),
    supabase.from("wheels_work_plan_items").select("product_id, quantity, status").in("plan_date", [today, tomorrow]),
    isLineReady(),
  ]);

  const rawById = new Map(((raw.data ?? []) as WheelRaw[]).map((r) => [r.id, r]));
  const fin = (finishes.data ?? []) as WheelLookup[];
  const siz = (sizes.data ?? []) as WheelLookup[];
  const grv = (grooves.data ?? []) as WheelLookup[];
  const crateByRaw = new Map(((crates.data ?? []) as WheelCrate[]).map((c) => [c.raw_id, c]));

  const plannedByProduct = new Map<string, number>();
  for (const p of (plan.data ?? []) as { product_id: string; quantity: number; status: string }[]) {
    if (p.status === "cancelled") continue;
    plannedByProduct.set(p.product_id, (plannedByProduct.get(p.product_id) ?? 0) + p.quantity);
  }

  const ordered = flattenGroups(groupBoxes((boxes.data ?? []) as WheelBox[], rawById, fin, siz, grv));
  const items: ReadyItem[] = ordered.map((b) => {
    const r = rawById.get(b.raw_id);
    const crate = r ? crateByRaw.get(r.id) : undefined;
    return {
      productId: b.id,
      sku: b.sku,
      name: r ? rawWheelLabelTh(r, fin, siz, grv) : b.sku,
      nameEn: r ? rawWheelLabel(r, fin, siz, grv) : b.sku,
      note: b.name ?? null,
      unit: b.unit,
      stock: b.stock,
      minStock: b.min_stock,
      plannedQty: plannedByProduct.get(b.id) ?? 0,
      crate: crate ? { crates: crate.crate_qty, approxPieces: approxPieces(crate) } : null,
    };
  });

  return (
    <StockReadyCheckClient
      items={items}
      canCreateTicket={true}
      lineReady={lineReady}
      onCreateTicket={createTicket}
      onNotifyLine={notifyStockLine}
    />
  );
}
