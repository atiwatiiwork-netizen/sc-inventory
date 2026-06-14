import { getWorkerSession } from "@/lib/worker-session";
import { createServiceClient } from "@/lib/supabase/server";
import type { Category, CustomerGroup, Product } from "@/lib/types";
import { WorkerFlow, type ExistingSubmission } from "@/components/worker-flow";

export default async function WorkerHome() {
  const session = (await getWorkerSession())!; // layout guarantees non-null
  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const [groups, cats, prods, subs] = await Promise.all([
    supabase.from("customer_groups").select("*").eq("active", true),
    supabase
      .from("categories")
      .select("*")
      .eq("active", true)
      .eq("archived", false)
      .eq("worker_entry", true)
      .order("display_order"),
    supabase.from("products").select("*").eq("active", true).order("display_order"),
    supabase
      .from("daily_submissions")
      .select("customer_group_id, no_usage, submitted_at, submission_items(product_id, qty)")
      .eq("worker_id", session.id)
      .eq("usage_date", today)
      .order("submitted_at", { ascending: true }),
  ]);

  type SubRow = {
    customer_group_id: string | null;
    no_usage: boolean;
    submitted_at: string | null;
    submission_items: { product_id: string; qty: number }[] | null;
  };
  const existing: ExistingSubmission[] = ((subs.data ?? []) as SubRow[]).map((s) => ({
    group: s.customer_group_id,
    noUsage: s.no_usage,
    items: Object.fromEntries((s.submission_items ?? []).map((it) => [it.product_id, it.qty])),
    time: s.submitted_at ? new Date(s.submitted_at).toTimeString().slice(0, 5) : "",
  }));

  return (
    <WorkerFlow
      worker={{ name: session.name, code: session.code }}
      customerGroups={(groups.data ?? []) as CustomerGroup[]}
      categories={(cats.data ?? []) as Category[]}
      products={(prods.data ?? []) as Product[]}
      today={today}
      existing={existing}
    />
  );
}
