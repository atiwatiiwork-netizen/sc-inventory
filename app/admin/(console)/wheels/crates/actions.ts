"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminActor } from "@/lib/wheels/role";

export type ActionResult = { ok: boolean; error?: string };

export type CrateInput = {
  id?: string; // present when editing
  raw_id: string;
  pieces_per_crate: number;
  crate_qty: number; // initial quantity on create only; edits use adjustCrate
  note: string;
  active: boolean;
};

const DUP = "23505";

const revalidate = () => {
  revalidatePath("/admin/wheels/crates");
  revalidatePath("/admin/wheels");
};

/**
 * Create or edit a crate record. Create sets the initial crate_qty (and logs an
 * opening move if > 0). Edit changes pieces_per_crate / note / active only —
 * crate_qty is changed through adjustCrate so every change is in the history.
 */
export async function saveCrate(input: CrateInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { by } = await getAdminActor();
  if (!input.raw_id) return { ok: false, error: "กรุณาเลือกล้อดิบ" };
  if (!(input.pieces_per_crate > 0)) return { ok: false, error: "จำนวนชิ้นต่อลังต้องมากกว่า 0" };

  if (input.id) {
    const { error } = await supabase
      .from("wheels_crates")
      .update({
        pieces_per_crate: input.pieces_per_crate,
        note: input.note.trim() || null,
        active: input.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const qty = Math.max(0, input.crate_qty || 0);
    const { data, error } = await supabase
      .from("wheels_crates")
      .insert({
        raw_id: input.raw_id,
        pieces_per_crate: input.pieces_per_crate,
        crate_qty: qty,
        note: input.note.trim() || null,
        active: input.active,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.code === DUP ? "มีบันทึกลังของล้อดิบนี้อยู่แล้ว" : error.message };
    if (qty > 0 && data) {
      await supabase.from("wheels_crate_moves").insert({
        crate_id: data.id,
        delta: qty,
        before_qty: 0,
        after_qty: qty,
        note: "ยอดเริ่มต้น",
        created_by: by,
      });
    }
  }

  revalidate();
  return { ok: true };
}

/**
 * Manual quantity adjustment (the only path that changes crate_qty). `mode`
 * 'set' replaces the quantity; 'delta' applies a signed change. Records history.
 */
export async function adjustCrate(id: string, mode: "set" | "delta", value: number, note: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { by } = await getAdminActor();

  const { data: crate, error: readErr } = await supabase.from("wheels_crates").select("crate_qty").eq("id", id).single();
  if (readErr || !crate) return { ok: false, error: "ไม่พบบันทึกลัง" };

  const before = crate.crate_qty as number;
  const after = mode === "set" ? Math.max(0, value) : Math.max(0, before + value);
  if (after === before) return { ok: false, error: "ยอดไม่เปลี่ยนแปลง" };

  const { error: updErr } = await supabase
    .from("wheels_crates")
    .update({ crate_qty: after, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updErr) return { ok: false, error: updErr.message };

  await supabase.from("wheels_crate_moves").insert({
    crate_id: id,
    delta: after - before,
    before_qty: before,
    after_qty: after,
    note: note.trim() || null,
    created_by: by,
  });

  revalidate();
  return { ok: true };
}

/** Delete a crate record (its history cascades). No other table references it. */
export async function deleteCrate(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("wheels_crates").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
