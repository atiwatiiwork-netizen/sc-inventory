"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; error?: string; diff?: number };

export async function recordAdjustment(input: { productId: string; actual: number; note: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc("record_adjustment", {
    p_product: input.productId,
    p_actual: input.actual,
    p_note: input.note || "",
    p_by: user?.email ?? "admin",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/adjustments");
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  return { ok: true, diff: (data as number) ?? 0 };
}
