import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/worker-session";
import { canUseWheelsFunction } from "@/lib/wheels/worker-access";
import { createServiceClient } from "@/lib/supabase/server";
import type { WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { rawWheelLabel } from "@/lib/wheels/sku";
import { groupBoxes, flattenGroups } from "@/lib/wheels/grouping";
import { PILOT_BOX_SKUS, PILOT_LIMIT } from "@/lib/wheels/pilot";
import { StockCheckClient, type StockItem } from "@/components/wheels/stock-check-client";

/** Worker-side Stock Reality Check — same finished-goods list as admin, role-gated. */
export default async function WorkerStockCheckPage() {
  const session = (await getWorkerSession())!;
  if (!(await canUseWheelsFunction(session.id, "wheels-stock-check"))) redirect("/worker/wheels");

  const supabase = createServiceClient();
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

  const ordered = flattenGroups(groupBoxes((boxes.data ?? []) as WheelBox[], rawById, fin, siz, grv));
  const all: StockItem[] = ordered.map((b) => {
    const r = rawById.get(b.raw_id);
    return { sku: b.sku, name: r ? rawWheelLabel(r, fin, siz, grv) : b.sku, note: b.name ?? null, stock: b.stock, unit: b.unit };
  });
  const items = PILOT_BOX_SKUS.length ? all.filter((i) => PILOT_BOX_SKUS.includes(i.sku)) : all.slice(0, PILOT_LIMIT);

  return <StockCheckClient items={items} />;
}
