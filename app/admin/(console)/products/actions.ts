"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ProductInput = {
  id?: string; // present when editing
  sku: string;
  name: string;
  name_en: string;
  category_id: string;
  unit: string;
  size: string;
  length: string;
  min_stock: number;
  display_order: number;
  active: boolean;
};

export type ActionResult = { ok: boolean; error?: string };

/** Parse "3m" / "2 m" → 3 ; empty → null (rails get a numeric length). */
function parseLengthM(length: string): number | null {
  const n = parseFloat(length.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function saveProduct(input: ProductInput): Promise<ActionResult> {
  const supabase = await createClient();
  if (!input.sku.trim()) return { ok: false, error: "กรุณากรอก SKU" };
  if (!input.name.trim()) return { ok: false, error: "กรุณากรอกชื่อสินค้า" };

  const row = {
    sku: input.sku.trim(),
    name: input.name.trim(),
    name_en: input.name_en.trim() || null,
    category_id: input.category_id,
    unit: input.unit.trim() || null,
    size: input.size.trim() || null,
    length: input.length.trim() || null,
    length_m: parseLengthM(input.length),
    min_stock: input.min_stock || 0,
    display_order: input.display_order || 0,
    active: input.active,
  };

  if (input.id) {
    const { error } = await supabase.from("products").update(row).eq("id", input.id);
    if (error) return { ok: false, error: error.code === "23505" ? "SKU นี้มีอยู่แล้ว" : error.message };
  } else {
    const { error } = await supabase.from("products").insert({ ...row, stock: 0, archived: false });
    if (error) return { ok: false, error: error.code === "23505" ? "SKU นี้มีอยู่แล้ว" : error.message };
  }

  revalidatePath("/admin/products");
  return { ok: true };
}

/** Delete only if the product has no transaction history (per spec). */
export async function deleteProduct(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const [{ count: txns }, { count: items }] = await Promise.all([
    supabase.from("stock_transactions").select("*", { count: "exact", head: true }).eq("product_id", id),
    supabase.from("submission_items").select("*", { count: "exact", head: true }).eq("product_id", id),
  ]);
  if ((txns ?? 0) > 0 || (items ?? 0) > 0) {
    return { ok: false, error: "สินค้ามีประวัติการเคลื่อนไหวแล้ว — ใช้การปิดใช้งานแทนการลบ" };
  }
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/products");
  return { ok: true };
}
