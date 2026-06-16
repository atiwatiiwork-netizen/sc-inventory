import { createClient } from "@/lib/supabase/server";
import type { WheelAssembly, WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { rawWheelLabel } from "@/lib/wheels/sku";
import { groupBoxes, flattenGroups } from "@/lib/wheels/grouping";
import type { WorkPlanItem } from "@/lib/wheels/work-plan";
import { WorkPlanClient, type PlanProduct } from "@/components/wheels/work-plan-client";

/**
 * SC Wheels — Work Plan v1 (Phase 5). A simple shared "factory work focus" board:
 * owner/admin record what the factory should focus on Today / Tomorrow; office,
 * warehouse and factory all see the same intent. INFORMATION ONLY — it records and
 * displays the plan; it never affects stock, transactions, production or sales.
 */
export default async function WorkPlanPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const tmr = new Date(`${today}T00:00:00Z`);
  tmr.setUTCDate(tmr.getUTCDate() + 1);
  const tomorrow = tmr.toISOString().slice(0, 10);

  const [items, boxes, assemblies, raw, finishes, sizes, grooves] = await Promise.all([
    supabase.from("wheels_work_plan_items").select("*").in("plan_date", [today, tomorrow]).order("created_at"),
    supabase.from("wheels_boxes").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_assemblies").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_raw").select("*"),
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
  ]);

  const rawById = new Map(((raw.data ?? []) as WheelRaw[]).map((r) => [r.id, r]));
  const fin = (finishes.data ?? []) as WheelLookup[];
  const siz = (sizes.data ?? []) as WheelLookup[];
  const grv = (grooves.data ?? []) as WheelLookup[];

  // Product picker: packed boxes (canonical order) + assemblies.
  const orderedBoxes = flattenGroups(groupBoxes((boxes.data ?? []) as WheelBox[], rawById, fin, siz, grv));
  const products: PlanProduct[] = [
    ...orderedBoxes.map((b) => {
      const r = rawById.get(b.raw_id);
      return {
        kind: "box" as const,
        id: b.id,
        sku: b.sku,
        name: r ? rawWheelLabel(r, fin, siz, grv) : b.sku,
        unit: b.unit,
      };
    }),
    ...((assemblies.data ?? []) as WheelAssembly[]).map((a) => ({
      kind: "assembly" as const,
      id: a.id,
      sku: a.sku,
      name: a.name,
      unit: a.unit,
    })),
  ];

  return (
    <WorkPlanClient
      items={(items.data ?? []) as WorkPlanItem[]}
      products={products}
      today={today}
      tomorrow={tomorrow}
    />
  );
}
