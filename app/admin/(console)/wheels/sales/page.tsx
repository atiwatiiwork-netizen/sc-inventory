import { createClient } from "@/lib/supabase/server";
import { getAdminActor } from "@/lib/wheels/role";
import type { WheelAssembly, WheelBox } from "@/lib/wheels/types";
import { SalesClient, type Sellable } from "@/components/wheels/sales-client";

export default async function SalesPage() {
  const supabase = await createClient();
  const { isAdmin } = await getAdminActor();
  const today = new Date().toISOString().slice(0, 10);

  const [boxes, assemblies] = await Promise.all([
    supabase.from("wheels_boxes").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_assemblies").select("*").eq("active", true).eq("archived", false).order("display_order"),
  ]);

  const sellables: Sellable[] = [
    ...((boxes.data ?? []) as WheelBox[]).map((b) => ({
      layer: "box" as const,
      id: b.id,
      sku: b.sku,
      label: b.name ?? b.sku,
      unit: b.unit,
      stock: b.stock,
    })),
    ...((assemblies.data ?? []) as WheelAssembly[]).map((a) => ({
      layer: "assembly" as const,
      id: a.id,
      sku: a.sku,
      label: a.name,
      unit: a.unit,
      stock: a.stock,
    })),
  ];

  return <SalesClient mode="standard" sellables={sellables} isAdmin={isAdmin} today={today} />;
}
