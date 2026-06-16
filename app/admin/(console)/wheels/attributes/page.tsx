import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminActor } from "@/lib/wheels/role";
import type { WheelLookup } from "@/lib/wheels/types";
import { AttributesClient } from "@/components/wheels/attributes-client";

/** Admin-only management of the extensible Version / Size / Groove lookups. */
export default async function AttributesPage() {
  const { isAdmin } = await getAdminActor();
  if (!isAdmin) redirect("/admin/wheels");

  const supabase = await createClient();
  const [versions, sizes, grooves] = await Promise.all([
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
  ]);

  return (
    <AttributesClient
      versions={(versions.data ?? []) as WheelLookup[]}
      sizes={(sizes.data ?? []) as WheelLookup[]}
      grooves={(grooves.data ?? []) as WheelLookup[]}
    />
  );
}
