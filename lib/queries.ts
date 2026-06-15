import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LOOKBACK_DAYS, type Movement } from "@/lib/insights";

/** YYYY-MM-DD `days` ago. */
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

type MovementQueryRow = {
  product_id: string;
  txn_date: string;
  qty: number;
  products:
    | { sku: string; name: string; category_id: string | null; length_m: number | null; size: string | null; unit: string | null }
    | null;
};

/** Stock-out movements (worker usage) over the lookback window. */
export async function getMovements(supabase: SupabaseClient, days = LOOKBACK_DAYS): Promise<Movement[]> {
  const { data } = await supabase
    .from("stock_transactions")
    .select("product_id, txn_date, qty, products(sku, name, category_id, length_m, size, unit)")
    .eq("type", "out")
    .gte("txn_date", isoDaysAgo(days))
    .order("txn_date", { ascending: true });

  return ((data ?? []) as unknown as MovementQueryRow[]).map((r) => ({
    product_id: r.product_id,
    txn_date: r.txn_date,
    qty: r.qty,
    product: r.products,
  }));
}

export type WorkerStatus = {
  code: string;
  name: string;
  status: "submitted" | "pending";
  groupName: string | null;
  time: string | null;
  itemCount: number;
};

/** Today's submission status for every active worker. */
export async function getWorkerStatusToday(supabase: SupabaseClient, today: string): Promise<WorkerStatus[]> {
  const [{ data: workers }, { data: subs }, { data: groups }] = await Promise.all([
    supabase.from("workers").select("id, code, name").eq("active", true).order("code"),
    supabase
      .from("daily_submissions")
      .select("worker_id, customer_group_id, no_usage, submitted_at, submission_items(product_id)")
      .eq("usage_date", today),
    supabase.from("customer_groups").select("id, name"),
  ]);

  const groupName = new Map((groups ?? []).map((g: { id: string; name: string }) => [g.id, g.name]));
  type SubRow = {
    worker_id: string;
    customer_group_id: string | null;
    no_usage: boolean;
    submitted_at: string | null;
    submission_items: { product_id: string }[] | null;
  };
  const byWorker = new Map<string, SubRow>(((subs ?? []) as SubRow[]).map((s) => [s.worker_id, s]));

  return ((workers ?? []) as { id: string; code: string; name: string }[]).map((w) => {
    const s = byWorker.get(w.id);
    return {
      code: w.code,
      name: w.name,
      status: s ? "submitted" : "pending",
      groupName: s ? (s.no_usage ? "ไม่มีการใช้งาน" : groupName.get(s.customer_group_id ?? "") ?? null) : null,
      time: s?.submitted_at ? new Date(s.submitted_at).toTimeString().slice(0, 5) : null,
      itemCount: s?.submission_items?.length ?? 0,
    };
  });
}

export type ReportRow = {
  date: string;
  group: string | null;
  productId: string;
  categoryId: string | null;
  lengthM: number | null;
  size: string | null;
  variant: string | null;
  sku: string;
  name: string;
  qty: number;
};

type SubmissionWindowRow = {
  usage_date: string;
  customer_group_id: string | null;
  submission_items:
    | {
        qty: number;
        products: { sku: string; name: string; category_id: string | null; length_m: number | null; size: string | null; variant: string | null } | null;
      }[]
    | null;
};

/** Flattened submission line items over the window — powers category reports. */
export async function getReportRows(supabase: SupabaseClient, days = LOOKBACK_DAYS): Promise<ReportRow[]> {
  const { data } = await supabase
    .from("daily_submissions")
    .select("usage_date, customer_group_id, submission_items(qty, products(sku, name, category_id, length_m, size, variant))")
    .gte("usage_date", isoDaysAgo(days))
    .order("usage_date", { ascending: true });

  const rows: ReportRow[] = [];
  ((data ?? []) as unknown as SubmissionWindowRow[]).forEach((s) => {
    s.submission_items?.forEach((it) => {
      if (!it.products) return;
      rows.push({
        date: s.usage_date,
        group: s.customer_group_id,
        productId: "",
        categoryId: it.products.category_id,
        lengthM: it.products.length_m,
        size: it.products.size,
        variant: it.products.variant,
        sku: it.products.sku,
        name: it.products.name,
        qty: it.qty,
      });
    });
  });
  return rows;
}

/** Sum today's usage per product id (from submission items). */
export async function getTodayUsage(supabase: SupabaseClient, today: string): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("daily_submissions")
    .select("submission_items(product_id, qty)")
    .eq("usage_date", today);

  const map: Record<string, number> = {};
  type Row = { submission_items: { product_id: string; qty: number }[] | null };
  ((data ?? []) as Row[]).forEach((s) =>
    s.submission_items?.forEach((it) => {
      map[it.product_id] = (map[it.product_id] || 0) + it.qty;
    }),
  );
  return map;
}
