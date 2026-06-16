import { createClient } from "@/lib/supabase/server";
import { getAdminActor } from "@/lib/wheels/role";
import type { WheelAssembly, WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { SalesClient, type Sellable } from "@/components/wheels/sales-client";

export default async function SalesPage() {
  const supabase = await createClient();
  const { isAdmin } = await getAdminActor();
  const today = new Date().toISOString().slice(0, 10);

  const [boxes, assemblies, raw, finishes, sizes, grooves] = await Promise.all([
    supabase.from("wheels_boxes").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_assemblies").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_raw").select("*"),
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
  ]);

  const rawById = new Map(((raw.data ?? []) as WheelRaw[]).map((r) => [r.id, r]));

  const sellables: Sellable[] = [
    ...((boxes.data ?? []) as WheelBox[]).map((b) => {
      const r = rawById.get(b.raw_id);
      return {
        layer: "box" as const,
        id: b.id,
        sku: b.sku,
        label: b.name ?? b.sku,
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

  return (
    <SalesClient
      mode="standard"
      sellables={sellables}
      isAdmin={isAdmin}
      today={today}
      finishes={(finishes.data ?? []) as WheelLookup[]}
      sizes={(sizes.data ?? []) as WheelLookup[]}
      grooves={(grooves.data ?? []) as WheelLookup[]}
    />
  );
}
