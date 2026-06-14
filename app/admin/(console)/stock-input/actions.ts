"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReceiveLine = { product_id: string; qty: number };
export type ReceiveResult = { ok: boolean; error?: string; count?: number };

/** Commit a grouped receiving as SKU-level 'in' transactions (atomic RPC). */
export async function receiveStock(input: {
  date: string;
  note: string;
  lines: ReceiveLine[];
}): Promise<ReceiveResult> {
  const lines = input.lines.filter((l) => l.product_id && l.qty > 0);
  if (lines.length === 0) return { ok: false, error: "ยังไม่ได้กรอกจำนวน" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc("receive_stock", {
    p_date: input.date,
    p_note: input.note || "",
    p_by: user?.email ?? "admin",
    p_lines: lines,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/stock-input");
  revalidatePath("/admin/products");
  return { ok: true, count: (data as number) ?? lines.length };
}
