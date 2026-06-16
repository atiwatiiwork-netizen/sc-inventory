"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; error?: string };

export type BoxInput = {
  id?: string; // present when editing
  sku: string;
  name: string;
  raw_id: string;
  units_per_box: number;
  unit: string;
  min_stock: number;
  display_order: number;
  active: boolean;
};

const DUP = "23505";

export async function saveBox(input: BoxInput): Promise<ActionResult> {
  const supabase = await createClient();
  if (!input.sku.trim()) return { ok: false, error: "กรุณากรอก SKU" };
  if (!input.raw_id) return { ok: false, error: "กรุณาเลือกล้อดิบที่บรรจุ" };
  if (!(input.units_per_box > 0)) return { ok: false, error: "จำนวนต่อกล่องต้องมากกว่า 0" };

  const row = {
    sku: input.sku.trim(),
    name: input.name.trim() || null,
    raw_id: input.raw_id,
    units_per_box: input.units_per_box,
    unit: input.unit.trim() || "กล่อง",
    min_stock: input.min_stock || 0,
    display_order: input.display_order || 0,
    active: input.active,
  };

  if (input.id) {
    const { error } = await supabase.from("wheels_boxes").update(row).eq("id", input.id);
    if (error) return { ok: false, error: error.code === DUP ? "SKU นี้มีอยู่แล้ว" : error.message };
  } else {
    const { error } = await supabase.from("wheels_boxes").insert({ ...row, archived: false });
    if (error) return { ok: false, error: error.code === DUP ? "SKU นี้มีอยู่แล้ว" : error.message };
  }

  revalidatePath("/admin/wheels/boxes");
  revalidatePath("/admin/wheels");
  return { ok: true };
}

/** Delete only if no BOM line references this box. */
export async function deleteBox(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { count } = await supabase.from("wheels_assembly_bom").select("*", { count: "exact", head: true }).eq("box_id", id);
  if ((count ?? 0) > 0) return { ok: false, error: "IN_USE" };

  const { error } = await supabase.from("wheels_boxes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/wheels/boxes");
  revalidatePath("/admin/wheels");
  return { ok: true };
}
