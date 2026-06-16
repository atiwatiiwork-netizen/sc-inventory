import { createClient } from "@/lib/supabase/server";
import type { WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { ReceivingClient } from "@/components/wheels/receiving-client";

export default async function ReceivingPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [raw, finishes, sizes, grooves] = await Promise.all([
    supabase.from("wheels_raw").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
  ]);

  return (
    <ReceivingClient
      raw={(raw.data ?? []) as WheelRaw[]}
      finishes={(finishes.data ?? []) as WheelLookup[]}
      sizes={(sizes.data ?? []) as WheelLookup[]}
      grooves={(grooves.data ?? []) as WheelLookup[]}
      today={today}
    />
  );
}
