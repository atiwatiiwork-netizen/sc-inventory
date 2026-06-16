"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BomComponentType } from "@/lib/wheels/types";

export type ActionResult = { ok: boolean; error?: string };

export type BomLineInput = {
  component_type: BomComponentType;
  raw_id: string | null;
  box_id: string | null;
  part_name: string | null;
  qty: number;
  unit: string | null;
};

export type AssemblyInput = {
  id?: string; // present when editing
  sku: string;
  name: string;
  name_en: string;
  unit: string;
  min_stock: number;
  display_order: number;
  active: boolean;
  bom: BomLineInput[];
};

const DUP = "23505";

/** Normalise a BOM line: keep only the id that matches its component_type. */
function cleanLine(l: BomLineInput, sort: number) {
  return {
    component_type: l.component_type,
    raw_id: l.component_type === "raw" ? l.raw_id : null,
    box_id: l.component_type === "box" ? l.box_id : null,
    part_name: l.component_type === "part" ? (l.part_name?.trim() || null) : null,
    qty: l.qty,
    unit: l.unit?.trim() || null,
    sort,
  };
}

function validateLine(l: BomLineInput): string | null {
  if (!(l.qty > 0)) return "จำนวนในแต่ละบรรทัด BOM ต้องมากกว่า 0";
  if (l.component_type === "raw" && !l.raw_id) return "กรุณาเลือกล้อดิบในบรรทัด BOM";
  if (l.component_type === "box" && !l.box_id) return "กรุณาเลือกกล่องบรรจุในบรรทัด BOM";
  if (l.component_type === "part" && !l.part_name?.trim()) return "กรุณากรอกชื่อชิ้นส่วนในบรรทัด BOM";
  return null;
}

export async function saveAssembly(input: AssemblyInput): Promise<ActionResult> {
  const supabase = await createClient();
  if (!input.sku.trim()) return { ok: false, error: "กรุณากรอก SKU" };
  if (!input.name.trim()) return { ok: false, error: "กรุณากรอกชื่อสินค้าประกอบ" };
  for (const l of input.bom) {
    const err = validateLine(l);
    if (err) return { ok: false, error: err };
  }

  const header = {
    sku: input.sku.trim(),
    name: input.name.trim(),
    name_en: input.name_en.trim() || null,
    unit: input.unit.trim() || "ชิ้น",
    min_stock: input.min_stock || 0,
    display_order: input.display_order || 0,
    active: input.active,
  };

  let assemblyId = input.id;
  if (assemblyId) {
    const { error } = await supabase.from("wheels_assemblies").update(header).eq("id", assemblyId);
    if (error) return { ok: false, error: error.code === DUP ? "SKU นี้มีอยู่แล้ว" : error.message };
  } else {
    const { data, error } = await supabase.from("wheels_assemblies").insert({ ...header, archived: false }).select("id").single();
    if (error) return { ok: false, error: error.code === DUP ? "SKU นี้มีอยู่แล้ว" : error.message };
    assemblyId = data!.id as string;
  }

  // Replace BOM lines: clear existing, insert the current set.
  await supabase.from("wheels_assembly_bom").delete().eq("assembly_id", assemblyId);
  if (input.bom.length > 0) {
    const rows = input.bom.map((l, i) => ({ assembly_id: assemblyId, ...cleanLine(l, i) }));
    const { error } = await supabase.from("wheels_assembly_bom").insert(rows);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/wheels/assemblies");
  revalidatePath("/admin/wheels");
  return { ok: true };
}

/** Delete an assembly. BOM lines cascade automatically (FK on delete cascade). */
export async function deleteAssembly(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("wheels_assemblies").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/wheels/assemblies");
  revalidatePath("/admin/wheels");
  return { ok: true };
}
