import { createClient } from "@/lib/supabase/server";
import type { WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { BoxesClient } from "@/components/wheels/boxes-client";

export default async function BoxesPage() {
  const supabase = await createClient();
  const [boxes, raw, finishes, sizes, grooves] = await Promise.all([
    supabase.from("wheels_boxes").select("*").order("display_order"),
    supabase.from("wheels_raw").select("*").eq("archived", false).order("display_order"),
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
  ]);

  return (
    <BoxesClient
      boxes={(boxes.data ?? []) as WheelBox[]}
      raw={(raw.data ?? []) as WheelRaw[]}
      finishes={(finishes.data ?? []) as WheelLookup[]}
      sizes={(sizes.data ?? []) as WheelLookup[]}
      grooves={(grooves.data ?? []) as WheelLookup[]}
    />
  );
}
