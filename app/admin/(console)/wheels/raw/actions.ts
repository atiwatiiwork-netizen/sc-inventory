"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; error?: string };

export type RawInput = {
  id?: string; // present when editing
  sku: string;
  name: string;
  finish: string;
  size: string;
  groove: string;
  unit: string;
  min_stock: number;
  display_order: number;
  active: boolean;
};

const DUP = "23505";

export async function saveRawWheel(input: RawInput): Promise<ActionResult> {
  const supabase = await createClient();
  if (!input.sku.trim()) return { ok: false, error: "กรุณากรอก SKU" };
  if (!input.finish || !input.size || !input.groove) return { ok: false, error: "กรุณาเลือกผิวชุบ ขนาด และร่องให้ครบ" };

  const row = {
    sku: input.sku.trim(),
    name: input.name.trim() || null,
    finish: input.finish,
    size: input.size,
    groove: input.groove,
    unit: input.unit.trim() || "ลูก",
    min_stock: input.min_stock || 0,
    display_order: input.display_order || 0,
    active: input.active,
  };

  // a raw wheel is uniquely defined by finish × size × groove
  const dupMsg = (code?: string) =>
    code === DUP ? "มีล้อดิบ SKU นี้ หรือชุด (ผิวชุบ/ขนาด/ร่อง) นี้อยู่แล้ว" : undefined;

  if (input.id) {
    const { error } = await supabase.from("wheels_raw").update(row).eq("id", input.id);
    if (error) return { ok: false, error: dupMsg(error.code) ?? error.message };
  } else {
    const { error } = await supabase.from("wheels_raw").insert({ ...row, archived: false });
    if (error) return { ok: false, error: dupMsg(error.code) ?? error.message };
  }

  revalidatePath("/admin/wheels/raw");
  revalidatePath("/admin/wheels");
  return { ok: true };
}

export type BulkResult = { ok: boolean; created: number; skipped: { sku: string; reason: string }[]; error?: string };

/**
 * Create many raw wheels at once (catalog bulk add). Inserts row-by-row so one
 * duplicate (dup SKU or dup finish×size×groove → 23505) is skipped, not fatal.
 * Does not touch movement/stock logic.
 */
export async function saveRawWheelsBulk(inputs: RawInput[]): Promise<BulkResult> {
  const supabase = await createClient();
  const rows = inputs.filter((i) => i.sku.trim() && i.finish && i.size && i.groove);
  if (rows.length === 0) return { ok: false, created: 0, skipped: [], error: "ไม่มีรายการให้สร้าง" };

  let created = 0;
  const skipped: { sku: string; reason: string }[] = [];

  for (const input of rows) {
    const { error } = await supabase.from("wheels_raw").insert({
      sku: input.sku.trim(),
      name: input.name.trim() || null,
      finish: input.finish,
      size: input.size,
      groove: input.groove,
      unit: input.unit.trim() || "ลูก",
      min_stock: input.min_stock || 0,
      display_order: input.display_order || 0,
      active: input.active,
      archived: false,
    });
    if (error) {
      skipped.push({ sku: input.sku.trim(), reason: error.code === DUP ? "มีอยู่แล้ว (SKU หรือชุดซ้ำ)" : error.message });
    } else {
      created += 1;
    }
  }

  revalidatePath("/admin/wheels/raw");
  revalidatePath("/admin/wheels");
  return { ok: created > 0, created, skipped };
}

/** Delete only if no box or BOM line references this raw wheel. */
export async function deleteRawWheel(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const [{ count: boxes }, { count: bom }] = await Promise.all([
    supabase.from("wheels_boxes").select("*", { count: "exact", head: true }).eq("raw_id", id),
    supabase.from("wheels_assembly_bom").select("*", { count: "exact", head: true }).eq("raw_id", id),
  ]);
  if ((boxes ?? 0) > 0 || (bom ?? 0) > 0) return { ok: false, error: "IN_USE" };

  const { error } = await supabase.from("wheels_raw").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/wheels/raw");
  revalidatePath("/admin/wheels");
  return { ok: true };
}
