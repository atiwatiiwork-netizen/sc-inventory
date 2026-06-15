import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";
import { AdjustClient, type AdjustRow } from "@/components/adjust-client";

type AdjQueryRow = {
  adj_date: string;
  system_qty: number | null;
  actual_qty: number | null;
  diff: number | null;
  note: string | null;
  created_by: string | null;
  products: { sku: string; name: string } | null;
};

export default async function AdjustmentsPage() {
  const supabase = await createClient();
  const [prods, adj] = await Promise.all([
    supabase.from("products").select("*").eq("active", true).order("display_order"),
    supabase
      .from("adjustments")
      .select("adj_date, system_qty, actual_qty, diff, note, created_by, products(sku, name)")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const history: AdjustRow[] = ((adj.data ?? []) as unknown as AdjQueryRow[]).map((r) => ({
    date: r.adj_date,
    sku: r.products?.sku ?? "—",
    name: r.products?.name ?? "",
    sys: r.system_qty ?? 0,
    act: r.actual_qty ?? 0,
    diff: r.diff ?? 0,
    note: r.note,
    by: r.created_by,
  }));

  return <AdjustClient products={(prods.data ?? []) as Product[]} history={history} />;
}
