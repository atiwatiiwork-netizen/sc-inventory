"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminActor } from "@/lib/wheels/role";
import { slugify } from "@/lib/wheels/sku";

export type AttrKind = "version" | "size" | "groove";
export type ActionResult = { ok: boolean; error?: string };

const TABLE: Record<AttrKind, string> = {
  version: "wheels_finishes",
  size: "wheels_sizes",
  groove: "wheels_grooves",
};
// the column on wheels_raw that references each lookup (for the delete guard)
const RAW_COL: Record<AttrKind, string> = { version: "finish", size: "size", groove: "groove" };

export type AttrInput = { kind: AttrKind; id: string; th: string; en: string; sort: number; isNew: boolean };

export async function saveAttr(input: AttrInput): Promise<ActionResult> {
  const { isAdmin } = await getAdminActor();
  if (!isAdmin) return { ok: false, error: "เฉพาะผู้ดูแล (admin) เท่านั้น" };
  if (!input.th.trim() || !input.en.trim()) return { ok: false, error: "กรุณากรอกชื่อ (ไทย/อังกฤษ)" };

  const supabase = await createClient();
  const table = TABLE[input.kind];

  if (input.isNew) {
    const id = (input.id.trim() || slugify(input.en)).slice(0, 40);
    if (!id) return { ok: false, error: "กรุณากรอกรหัส (id)" };
    const { error } = await supabase
      .from(table)
      .insert({ id, th: input.th.trim(), en: input.en.trim(), sort: input.sort || 0 });
    if (error) return { ok: false, error: error.code === "23505" ? "รหัสนี้มีอยู่แล้ว" : error.message };
  } else {
    const { error } = await supabase
      .from(table)
      .update({ th: input.th.trim(), en: input.en.trim(), sort: input.sort || 0 })
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/wheels/attributes");
  revalidatePath("/admin/wheels/raw");
  return { ok: true };
}

/** Delete a lookup value only when no raw wheel references it. */
export async function deleteAttr(kind: AttrKind, id: string): Promise<ActionResult> {
  const { isAdmin } = await getAdminActor();
  if (!isAdmin) return { ok: false, error: "เฉพาะผู้ดูแล (admin) เท่านั้น" };

  const supabase = await createClient();
  const { count } = await supabase
    .from("wheels_raw")
    .select("*", { count: "exact", head: true })
    .eq(RAW_COL[kind], id);
  if ((count ?? 0) > 0) return { ok: false, error: "IN_USE" };

  const { error } = await supabase.from(TABLE[kind]).delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/wheels/attributes");
  revalidatePath("/admin/wheels/raw");
  return { ok: true };
}
