import { getWorkerSession } from "@/lib/worker-session";
import { createServiceClient } from "@/lib/supabase/server";
import type { WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { rawWheelLabel } from "@/lib/wheels/sku";
import { ProductionClient, type ProdOutput } from "@/components/wheels/production-client";

export default async function PackingPage() {
  const session = (await getWorkerSession())!;
  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const [boxes, raw, finishes, sizes, grooves, prod] = await Promise.all([
    supabase.from("wheels_boxes").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_raw").select("*"),
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
    supabase.from("wheels_production").select("id").eq("worker_id", session.id).eq("prod_date", today).maybeSingle(),
  ]);

  const rawById = new Map(((raw.data ?? []) as WheelRaw[]).map((r) => [r.id, r]));
  const fin = (finishes.data ?? []) as WheelLookup[];
  const siz = (sizes.data ?? []) as WheelLookup[];
  const grv = (grooves.data ?? []) as WheelLookup[];

  let existing: Record<string, number> = {};
  if (prod.data?.id) {
    const { data: items } = await supabase
      .from("wheels_production_items")
      .select("box_id, qty")
      .eq("production_id", prod.data.id)
      .eq("kind", "pack");
    existing = Object.fromEntries(((items ?? []) as { box_id: string; qty: number }[]).map((i) => [i.box_id, i.qty]));
  }

  const outputs: ProdOutput[] = ((boxes.data ?? []) as WheelBox[]).map((b) => {
    const r = rawById.get(b.raw_id);
    const rawLabel = r ? rawWheelLabel(r, fin, siz, grv) : "ล้อดิบ";
    return {
      id: b.id,
      sku: b.sku,
      label: b.name ?? `${rawLabel} (${b.units_per_box}/กล่อง)`,
      unit: b.unit,
      stock: b.stock,
      deductions: [{ label: rawLabel, sku: r?.sku ?? "", perUnit: b.units_per_box, unit: r?.unit ?? "ลูก", tracked: true }],
      version: r?.finish,
      size: r?.size,
      groove: r?.groove,
    };
  });

  return (
    <ProductionClient
      kind="pack"
      title="แพ็คกล่อง"
      outputs={outputs}
      existing={existing}
      today={today}
      finishes={fin}
      sizes={siz}
      grooves={grv}
    />
  );
}
