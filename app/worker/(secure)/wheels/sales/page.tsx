import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/worker-session";
import { canUseWheelsFunction } from "@/lib/wheels/worker-access";
import { createServiceClient } from "@/lib/supabase/server";
import type { InventoryLayer, WheelAssembly, WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { rawWheelLabel } from "@/lib/wheels/sku";
import type { Sellable } from "@/components/wheels/sales-client";
import { WorkerSalesClient, type WorkerSaleRow } from "@/components/wheels/worker-sales-client";

/**
 * Worker-side Sales Entry landing. Permission-gated by the 'wheels-sales' worker
 * function (default-CLOSED). Lists recorded sales first; the add button reveals the
 * existing SalesClient form, which commits via the RBAC-gated submitWorkerSale.
 * Reuses the existing sellables + sales tables — no new sales system.
 */
export default async function WorkerSalesPage() {
  const session = (await getWorkerSession())!;
  if (!(await canUseWheelsFunction(session.id, "wheels-sales"))) redirect("/worker/wheels");

  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const [boxes, assemblies, raw, finishes, sizes, grooves, sales] = await Promise.all([
    supabase.from("wheels_boxes").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_assemblies").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_raw").select("*"),
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
    supabase
      .from("wheels_sales")
      .select("id, sale_date, customer, voided, created_at, wheels_sale_items(layer, ref_id, qty)")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const rawById = new Map(((raw.data ?? []) as WheelRaw[]).map((r) => [r.id, r]));
  const fin = (finishes.data ?? []) as WheelLookup[];
  const siz = (sizes.data ?? []) as WheelLookup[];
  const grv = (grooves.data ?? []) as WheelLookup[];

  // Sellables — same construction as the admin sales screen (box + assembly).
  const boxById = new Map(((boxes.data ?? []) as WheelBox[]).map((b) => [b.id, b]));
  const asmById = new Map(((assemblies.data ?? []) as WheelAssembly[]).map((a) => [a.id, a]));
  const sellables: Sellable[] = [
    ...((boxes.data ?? []) as WheelBox[]).map((b) => {
      const r = rawById.get(b.raw_id);
      return {
        layer: "box" as const,
        id: b.id,
        sku: b.sku,
        label: b.name ?? (r ? rawWheelLabel(r, fin, siz, grv) : b.sku),
        unit: b.unit,
        stock: b.stock,
        version: r?.finish,
        size: r?.size,
        groove: r?.groove,
      };
    }),
    ...((assemblies.data ?? []) as WheelAssembly[]).map((a) => ({
      layer: "assembly" as const,
      id: a.id,
      sku: a.sku,
      label: a.name,
      unit: a.unit,
      stock: a.stock,
    })),
  ];

  // Recorded-sales summary for the landing list.
  const labelFor = (layer: InventoryLayer, refId: string): string => {
    if (layer === "box") {
      const b = boxById.get(refId);
      const r = b ? rawById.get(b.raw_id) : undefined;
      return b ? b.name ?? (r ? rawWheelLabel(r, fin, siz, grv) : b.sku) : "—";
    }
    if (layer === "assembly") return asmById.get(refId)?.name ?? "—";
    const r = rawById.get(refId);
    return r ? rawWheelLabel(r, fin, siz, grv) : "ล้อดิบ";
  };

  type SaleRow = {
    id: string;
    sale_date: string;
    customer: string | null;
    voided: boolean;
    wheels_sale_items: { layer: InventoryLayer; ref_id: string; qty: number }[] | null;
  };
  const history: WorkerSaleRow[] = ((sales.data ?? []) as unknown as SaleRow[]).map((s) => {
    const items = s.wheels_sale_items ?? [];
    return {
      id: s.id,
      date: s.sale_date,
      customer: s.customer,
      voided: s.voided,
      totalQty: items.reduce((sum, it) => sum + it.qty, 0),
      summary: items.map((it) => `${labelFor(it.layer, it.ref_id)} ×${it.qty}`).join(", ") || "—",
    };
  });

  return (
    <WorkerSalesClient sellables={sellables} today={today} finishes={fin} sizes={siz} grooves={grv} history={history} />
  );
}
