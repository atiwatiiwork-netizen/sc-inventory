import { createClient } from "@/lib/supabase/server";
import type { Category, Product } from "@/lib/types";
import type { TxnRow } from "@/components/flow-bits";
import { StockInputClient } from "@/components/stock-input-client";

const TYPE_LABEL: Record<string, string> = { in: "รับเข้า", adjust: "ปรับปรุง", out: "ใช้ออก" };

type TxnQueryRow = {
  txn_date: string;
  type: string;
  qty: number;
  note: string | null;
  created_by: string | null;
  products: { sku: string } | null;
};

export default async function StockInputPage() {
  const supabase = await createClient();

  const [cats, prods, txns] = await Promise.all([
    supabase.from("categories").select("*").eq("archived", false).order("display_order"),
    supabase.from("products").select("*").eq("active", true).order("display_order"),
    supabase
      .from("stock_transactions")
      .select("txn_date, type, qty, note, created_by, products(sku)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const history: TxnRow[] = ((txns.data ?? []) as unknown as TxnQueryRow[]).map((r) => ({
    date: r.txn_date,
    sku: r.products?.sku ?? "—",
    typeLabel: TYPE_LABEL[r.type] ?? r.type,
    qty: r.qty,
    note: r.note,
    by: r.created_by,
  }));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <StockInputClient
      categories={(cats.data ?? []) as Category[]}
      products={(prods.data ?? []) as Product[]}
      history={history}
      today={today}
    />
  );
}
