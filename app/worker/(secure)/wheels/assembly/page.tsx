import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/worker-session";
import { canUseWheelsFunction } from "@/lib/wheels/worker-access";
import { createServiceClient } from "@/lib/supabase/server";
import type { WheelAssembly, WheelBomLine, WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { rawWheelLabel } from "@/lib/wheels/sku";
import { ProductionClient, type Deduction, type ProdOutput } from "@/components/wheels/production-client";

export default async function AssemblyPage() {
  const session = (await getWorkerSession())!;
  if (!(await canUseWheelsFunction(session.id, "wheels-assembly"))) redirect("/worker/wheels");
  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const [assemblies, bom, raw, boxes, finishes, sizes, grooves, prod] = await Promise.all([
    supabase.from("wheels_assemblies").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_assembly_bom").select("*").order("sort"),
    supabase.from("wheels_raw").select("*"),
    supabase.from("wheels_boxes").select("*"),
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
    supabase.from("wheels_production").select("id").eq("worker_id", session.id).eq("prod_date", today).maybeSingle(),
  ]);

  const rawById = new Map(((raw.data ?? []) as WheelRaw[]).map((r) => [r.id, r]));
  const boxById = new Map(((boxes.data ?? []) as WheelBox[]).map((b) => [b.id, b]));
  const fin = (finishes.data ?? []) as WheelLookup[];
  const siz = (sizes.data ?? []) as WheelLookup[];
  const grv = (grooves.data ?? []) as WheelLookup[];

  const bomByAsm = new Map<string, WheelBomLine[]>();
  for (const l of (bom.data ?? []) as WheelBomLine[]) {
    const arr = bomByAsm.get(l.assembly_id) ?? [];
    arr.push(l);
    bomByAsm.set(l.assembly_id, arr);
  }

  let existing: Record<string, number> = {};
  if (prod.data?.id) {
    const { data: items } = await supabase
      .from("wheels_production_items")
      .select("assembly_id, qty")
      .eq("production_id", prod.data.id)
      .eq("kind", "assemble");
    existing = Object.fromEntries(((items ?? []) as { assembly_id: string; qty: number }[]).map((i) => [i.assembly_id, i.qty]));
  }

  const outputs: ProdOutput[] = ((assemblies.data ?? []) as WheelAssembly[]).map((a) => {
    const deductions: Deduction[] = (bomByAsm.get(a.id) ?? []).map((l) => {
      if (l.component_type === "raw") {
        const r = l.raw_id ? rawById.get(l.raw_id) : undefined;
        return { label: r ? rawWheelLabel(r, fin, siz, grv) : "ล้อดิบ", sku: r?.sku ?? "", perUnit: l.qty, unit: l.unit ?? r?.unit ?? "ลูก", tracked: true };
      }
      if (l.component_type === "box") {
        const b = l.box_id ? boxById.get(l.box_id) : undefined;
        return { label: b?.name ?? b?.sku ?? "กล่อง", sku: b?.sku ?? "", perUnit: l.qty, unit: l.unit ?? b?.unit ?? "กล่อง", tracked: true };
      }
      return { label: l.part_name ?? "ชิ้นส่วน", sku: "-", perUnit: l.qty, unit: l.unit ?? "", tracked: false };
    });
    return { id: a.id, sku: a.sku, label: a.name, unit: a.unit, stock: a.stock, deductions };
  });

  return <ProductionClient kind="assemble" title="ประกอบสินค้า" outputs={outputs} existing={existing} today={today} />;
}
