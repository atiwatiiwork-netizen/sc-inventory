"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CategoryInput = {
  id?: string; // present when editing
  name: string;
  name_en: string;
  display_order: number;
  report_unit: string;
  viz: string;
  active: boolean;
};

export type ActionResult = { ok: boolean; error?: string };

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || `cat-${Date.now().toString(36)}`
  );
}

export async function saveCategory(input: CategoryInput): Promise<ActionResult> {
  const supabase = await createClient();
  if (!input.name.trim()) return { ok: false, error: "กรุณากรอกชื่อหมวดหมู่" };

  // resolve the Thai unit label from the lookup table
  const { data: unit } = await supabase.from("report_units").select("th").eq("id", input.report_unit).maybeSingle();

  const row = {
    name: input.name.trim(),
    name_en: input.name_en.trim() || null,
    display_order: input.display_order || 0,
    report_unit: input.report_unit,
    report_unit_th: unit?.th ?? input.report_unit,
    viz: input.viz,
    active: input.active,
  };

  if (input.id) {
    const { error } = await supabase.from("categories").update(row).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const id = slugify(input.name_en || input.name);
    const { error } = await supabase.from("categories").insert({ id, archived: false, ...row });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function archiveCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  // Guard: do not archive a category that still has active products.
  const { count } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("category_id", id)
    .eq("active", true);
  if ((count ?? 0) > 0) {
    return { ok: false, error: "ยังมีสินค้าใช้งานอยู่ในหมวดนี้ — ปิดสินค้าก่อนจึงเก็บถาวรได้" };
  }
  const { error } = await supabase.from("categories").update({ archived: true, active: false }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/categories");
  return { ok: true };
}
