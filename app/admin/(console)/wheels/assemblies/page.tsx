import { createClient } from "@/lib/supabase/server";
import type { WheelAssembly, WheelBomLine, WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { AssembliesClient } from "@/components/wheels/assemblies-client";

export default async function AssembliesPage() {
  const supabase = await createClient();
  const [assemblies, bom, raw, boxes, finishes, sizes, grooves] = await Promise.all([
    supabase.from("wheels_assemblies").select("*").order("display_order"),
    supabase.from("wheels_assembly_bom").select("*").order("sort"),
    supabase.from("wheels_raw").select("*").eq("archived", false).order("display_order"),
    supabase.from("wheels_boxes").select("*").eq("archived", false).order("display_order"),
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
  ]);

  return (
    <AssembliesClient
      assemblies={(assemblies.data ?? []) as WheelAssembly[]}
      bom={(bom.data ?? []) as WheelBomLine[]}
      raw={(raw.data ?? []) as WheelRaw[]}
      boxes={(boxes.data ?? []) as WheelBox[]}
      finishes={(finishes.data ?? []) as WheelLookup[]}
      sizes={(sizes.data ?? []) as WheelLookup[]}
      grooves={(grooves.data ?? []) as WheelLookup[]}
    />
  );
}
