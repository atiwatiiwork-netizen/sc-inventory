import { getWorkerSession } from "@/lib/worker-session";
import { createServiceClient } from "@/lib/supabase/server";
import type { Category, CustomerGroup, Product } from "@/lib/types";
import { WorkerFlow, type ExistingSubmission } from "@/components/worker-flow";

export default async function WorkerHome() {
  const session = (await getWorkerSession())!; // layout guarantees non-null
  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const [groups, cats, prods, sub] = await Promise.all([
    supabase.from("customer_groups").select("*").eq("active", true),
    supabase.from("categories").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("products").select("*").eq("active", true).order("display_order"),
    supabase
      .from("daily_submissions")
      .select("id, customer_group_id, no_usage, submitted_at, submission_items(product_id, qty)")
      .eq("worker_id", session.id)
      .eq("usage_date", today)
      .maybeSingle(),
  ]);

  let existing: ExistingSubmission | null = null;
  if (sub.data) {
    const items: Record<string, number> = {};
    (sub.data.submission_items as { product_id: string; qty: number }[] | null)?.forEach((it) => {
      items[it.product_id] = it.qty;
    });
    existing = {
      group: sub.data.customer_group_id,
      noUsage: sub.data.no_usage,
      items,
      time: sub.data.submitted_at ? new Date(sub.data.submitted_at).toTimeString().slice(0, 5) : "",
    };
  }

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
