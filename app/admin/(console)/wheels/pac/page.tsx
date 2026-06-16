import { createClient } from "@/lib/supabase/server";
import type { WheelAssembly, WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { rawWheelLabel } from "@/lib/wheels/sku";
import { groupBoxes, flattenGroups } from "@/lib/wheels/grouping";
import { PacClient, type PacItem } from "@/components/wheels/pac-client";

/**
 * Sprint 5A — Product Availability Check (PAC). Passive office screen that
 * answers "can we say yes to this customer?" from data that already exists.
 *
 * Reuses, with NO new tables or new logic:
 *   - current stock      → wheels_boxes.stock / wheels_assemblies.stock (Phase 2 balances)
 *   - today's production → wheels_transactions pack_in / assemble_in (txn_date = today)
 *   - today's sales      → wheels_transactions sale (txn_date = today)
 *   - last production    → latest pack_in / assemble_in for the SKU
 *   - last sale          → latest sale for the SKU
 *
 * Availability is informational only (no recommendations):
 *   green  — stock above its minimum
 *   amber  — at/below minimum, but produced today
 *   red    — at/below minimum, and no production today
 */
export default async function PacPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [boxes, assemblies, raw, finishes, sizes, grooves, todayTx, lastProdTx, lastSaleTx] = await Promise.all([
    supabase.from("wheels_boxes").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_assemblies").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_raw").select("*"),
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
    // Today's movements (small set): production outputs + sales.
    supabase.from("wheels_transactions").select("layer, ref_id, type, qty").eq("txn_date", today),
    // Most-recent production outputs / sales — reduced to last-per-SKU in JS.
    supabase
      .from("wheels_transactions")
      .select("layer, ref_id, qty, txn_date, created_at")
      .in("type", ["pack_in", "assemble_in"])
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("wheels_transactions")
      .select("layer, ref_id, qty, txn_date, created_at")
      .eq("type", "sale")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

  const rawById = new Map(((raw.data ?? []) as WheelRaw[]).map((r) => [r.id, r]));
  const fin = (finishes.data ?? []) as WheelLookup[];
  const siz = (sizes.data ?? []) as WheelLookup[];
  const grv = (grooves.data ?? []) as WheelLookup[];

  // ---- Aggregate today's production / sales per (layer:ref) --------------
  type TodayRow = { layer: string; ref_id: string; type: string; qty: number };
  const todayProd = new Map<string, number>();
  const todaySale = new Map<string, number>();
  for (const t of (todayTx.data ?? []) as TodayRow[]) {
    const key = `${t.layer}:${t.ref_id}`;
    if (t.type === "pack_in" || t.type === "assemble_in") todayProd.set(key, (todayProd.get(key) ?? 0) + t.qty);
    else if (t.type === "sale") todaySale.set(key, (todaySale.get(key) ?? 0) + Math.abs(t.qty));
  }

  // ---- Last production / sale per (layer:ref) ----------------------------
  type LastRow = { layer: string; ref_id: string; qty: number; txn_date: string; created_at: string };
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
  const reduceLast = (rows: LastRow[]) => {
    // rows arrive newest-first; keep the first seen per key.
    const m = new Map<string, { date: string; time: string; qty: number }>();
    for (const r of rows) {
      const key = `${r.layer}:${r.ref_id}`;
      if (m.has(key)) continue;
      m.set(key, { date: r.txn_date, time: fmtTime(r.created_at), qty: Math.abs(r.qty) });
    }
    return m;
  };
  const lastProd = reduceLast((lastProdTx.data ?? []) as LastRow[]);
  const lastSale = reduceLast((lastSaleTx.data ?? []) as LastRow[]);

  // ---- Build one PacItem per finished good ------------------------------
  const toItem = (layer: "box" | "assembly", id: string, sku: string, name: string, note: string | null, unit: string, stock: number, minStock: number): PacItem => {
    const key = `${layer}:${id}`;
    const producedToday = todayProd.get(key) ?? 0;
    const low = stock <= minStock;
    const status: PacItem["status"] = !low ? "green" : producedToday > 0 ? "amber" : "red";
    return {
      layer,
      sku,
      name,
      note,
      unit,
      stock,
      minStock,
      status,
      todayProduction: producedToday,
      todaySales: todaySale.get(key) ?? 0,
      lastProduction: lastProd.get(key) ?? null,
      lastSale: lastSale.get(key) ?? null,
    };
  };

  // Packed boxes — in canonical Version → Size → Groove order (reuses grouping).
  const orderedBoxes = flattenGroups(groupBoxes((boxes.data ?? []) as WheelBox[], rawById, fin, siz, grv));
  const boxItems = orderedBoxes.map((b) => {
    const r = rawById.get(b.raw_id);
    return toItem("box", b.id, b.sku, r ? rawWheelLabel(r, fin, siz, grv) : b.sku, b.name ?? null, b.unit, b.stock, b.min_stock);
  });

  const asmItems = ((assemblies.data ?? []) as WheelAssembly[]).map((a) =>
    toItem("assembly", a.id, a.sku, a.name, a.name_en ?? null, a.unit, a.stock, a.min_stock),
  );

  return <PacClient items={[...boxItems, ...asmItems]} />;
}
