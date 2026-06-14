import { createClient } from "@/lib/supabase/server";
import type { Category, CustomerGroup, Product } from "@/lib/types";
import { getReportRows, type ReportRow } from "@/lib/queries";
import { ReportsClient } from "@/components/reports-client";

export default async function ReportsPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [cats, groups, prods, rows] = await Promise.all([
    supabase.from("categories").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("customer_groups").select("*").eq("active", true),
    supabase.from("products").select("*"),
    getReportRows(supabase),
  ]);

  return (
    <ReportsClient
      categories={(cats.data ?? []) as Category[]}
      customerGroups={(groups.data ?? []) as CustomerGroup[]}
      products={(prods.data ?? []) as Product[]}
      rows={rows as ReportRow[]}
      today={today}
    />
  );
}
