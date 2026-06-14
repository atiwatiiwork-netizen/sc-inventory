import { createClient } from "@/lib/supabase/server";
import type { Category, ReportUnit, VizType } from "@/lib/types";
import { CategoriesClient } from "@/components/categories-client";

export default async function CategoriesPage() {
  const supabase = await createClient();

  const [cats, units, viz, products] = await Promise.all([
    supabase.from("categories").select("*").order("display_order"),
    supabase.from("report_units").select("*").order("sort"),
    supabase.from("viz_types").select("*"),
    supabase.from("products").select("category_id"),
  ]);

  const counts: Record<string, number> = {};
  (products.data ?? []).forEach((p: { category_id: string | null }) => {
    if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
  });

  return (
    <CategoriesClient
      categories={(cats.data ?? []) as Category[]}
      units={(units.data ?? []) as ReportUnit[]}
      vizTypes={(viz.data ?? []) as VizType[]}
      counts={counts}
    />
  );
}
