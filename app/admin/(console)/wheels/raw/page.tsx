import { createClient } from "@/lib/supabase/server";
import type { WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { RawClient } from "@/components/wheels/raw-client";

export default async function RawWheelsPage() {
  const supabase = await createClient();
  const [raw, finishes, sizes, grooves] = await Promise.all([
    supabase.from("wheels_raw").select("*").order("display_order"),
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
  ]);

  return (
    <RawClient
      raw={(raw.data ?? []) as WheelRaw[]}
      finishes={(finishes.data ?? []) as WheelLookup[]}
      sizes={(sizes.data ?? []) as WheelLookup[]}
      grooves={(grooves.data ?? []) as WheelLookup[]}
    />
  );
}
