"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminActor } from "@/lib/wheels/role";
import { slugify } from "@/lib/wheels/sku";

export type ActionResult = { ok: boolean; error?: string };
export type RoleInput = { id: string; name: string; name_en: string; sort: number; active: boolean; isNew: boolean };

export async function saveWorkerRole(input: RoleInput): Promise<ActionResult> {
  const { isAdmin } = await getAdminActor();
  if (!isAdmin) return { ok: false, error: "เฉพาะผู้ดูแล (admin) เท่านั้น" };
  if (!input.name.trim()) return { ok: false, error: "กรุณากรอกชื่อบทบาท" };
  const supabase = await createClient();

  if (input.isNew) {
    const id = (input.id.trim() || slugify(input.name_en || input.name)).slice(0, 40);
    if (!id) return { ok: false, error: "กรุณากรอกรหัส (id)" };
    if (id === "general") return { ok: false, error: "รหัส general สงวนไว้สำหรับบทบาทระบบ" };
    const { error } = await supabase
      .from("worker_roles")
      .insert({ id, name: input.name.trim(), name_en: input.name_en.trim() || null, sort: input.sort || 0, active: input.active, is_system: false });
    if (error) return { ok: false, error: error.code === "23505" ? "รหัสนี้มีอยู่แล้ว" : error.message };
  } else {
    // protected system role cannot be renamed or deactivated
    const { data: role } = await supabase.from("worker_roles").select("is_system").eq("id", input.id).maybeSingle();
    if (role?.is_system) return { ok: false, error: "บทบาทระบบ (ทั่วไป) ไม่สามารถแก้ชื่อหรือปิดใช้งานได้" };
    const { error } = await supabase
      .from("worker_roles")
      .update({ name: input.name.trim(), name_en: input.name_en.trim() || null, sort: input.sort || 0, active: input.active })
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/admin/wheels/worker-access");
  return { ok: true };
}

/** Delete a role only when (a) it is not a system role, (b) no worker uses it, (c) no function mapping exists. */
export async function deleteWorkerRole(id: string): Promise<ActionResult> {
  const { isAdmin } = await getAdminActor();
  if (!isAdmin) return { ok: false, error: "เฉพาะผู้ดูแล (admin) เท่านั้น" };
  const supabase = await createClient();

  const { data: role } = await supabase.from("worker_roles").select("is_system").eq("id", id).maybeSingle();
  if (role?.is_system) return { ok: false, error: "บทบาทระบบ (ทั่วไป) ลบไม่ได้" };

  const [{ count: workers }, { count: maps }] = await Promise.all([
    supabase.from("workers").select("*", { count: "exact", head: true }).eq("role_id", id),
    supabase.from("wheels_function_roles").select("*", { count: "exact", head: true }).eq("role_id", id),
  ]);
  if ((workers ?? 0) > 0) return { ok: false, error: "IN_USE_WORKERS" };
  if ((maps ?? 0) > 0) return { ok: false, error: "IN_USE_MAPPINGS" };

  const { error } = await supabase.from("worker_roles").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/wheels/worker-access");
  return { ok: true };
}

/** Toggle whether a role may use a function. (function_key is an immutable internal id.) */
export async function setFunctionRole(function_key: string, role_id: string, allowed: boolean): Promise<ActionResult> {
  const { isAdmin } = await getAdminActor();
  if (!isAdmin) return { ok: false, error: "เฉพาะผู้ดูแล (admin) เท่านั้น" };
  const supabase = await createClient();
  if (allowed) {
    const { error } = await supabase.from("wheels_function_roles").upsert({ function_key, role_id }, { onConflict: "function_key,role_id" });
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("wheels_function_roles").delete().eq("function_key", function_key).eq("role_id", role_id);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/admin/wheels/worker-access");
  return { ok: true };
}
