import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminActor } from "@/lib/wheels/role";
import type { WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { rawWheelLabel } from "@/lib/wheels/sku";
import { SalesClient, type Sellable } from "@/components/wheels/sales-client";

/** Admin-only exceptional direct raw-wheel sale (hidden from office users). */
export default async function RawSalesPage() {
  const { isAdmin } = await getAdminActor();
  if (!isAdmin) redirect("/admin/wheels"); // defence-in-depth (nav already hides it)

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [raw, finishes, sizes, grooves] = await Promise.all([
    supabase.from("wheels_raw").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
  ]);

  const fin = (finishes.data ?? []) as WheelLookup[];
  const siz = (sizes.data ?? []) as WheelLookup[];
  const grv = (grooves.data ?? []) as WheelLookup[];

  const sellables: Sellable[] = ((raw.data ?? []) as WheelRaw[]).map((r) => ({
    layer: "raw" as const,
    id: r.id,
    sku: r.sku,
    label: rawWheelLabel(r, fin, siz, grv),
    unit: r.unit,
    stock: r.stock,
  }));

  return <SalesClient mode="raw" sellables={sellables} isAdmin={isAdmin} today={today} />;
}
