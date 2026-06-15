"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; error?: string };

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || `grp-${Date.now().toString(36)}`
  );
}

export async function saveGroup(input: { id?: string; name: string; name_en: string; active: boolean }): Promise<ActionResult> {
  const supabase = await createClient();
  if (!input.name.trim()) return { ok: false, error: "กรุณากรอกชื่อกลุ่ม" };
  const row = { name: input.name.trim(), name_en: input.name_en.trim() || null, active: input.active };

  if (input.id) {
    const { error } = await supabase.from("customer_groups").update(row).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const id = slugify(input.name_en || input.name);
    const { error } = await supabase.from("customer_groups").insert({ id, ...row });
    if (error) return { ok: false, error: error.code === "23505" ? "มีกลุ่มนี้อยู่แล้ว" : error.message };
  }
  revalidatePath("/admin/customer-groups");
  return { ok: true };
}

export async function setGroupActive(id: string, on: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("customer_groups").update({ active: on }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/customer-groups");
  return { ok: true };
}
