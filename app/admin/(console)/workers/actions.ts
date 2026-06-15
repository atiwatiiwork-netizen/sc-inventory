"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; error?: string };

export async function saveWorker(input: { id?: string; code: string; name: string; pin: string; active: boolean }): Promise<ActionResult> {
  const supabase = await createClient();
  if (!input.code.trim()) return { ok: false, error: "กรุณากรอกรหัสพนักงาน" };
  if (!input.name.trim()) return { ok: false, error: "กรุณากรอกชื่อ" };
  if (!/^\d{4}$/.test(input.pin)) return { ok: false, error: "PIN ต้องเป็นตัวเลข 4 หลัก" };

  // PIN must be unique among workers
  const dup = await supabase.from("workers").select("id").eq("pin", input.pin).neq("id", input.id ?? "00000000-0000-0000-0000-000000000000");
  if ((dup.data?.length ?? 0) > 0) return { ok: false, error: "PIN นี้ถูกใช้กับพนักงานคนอื่นแล้ว" };

  const row = { code: input.code.trim(), name: input.name.trim(), pin: input.pin, active: input.active };
  if (input.id) {
    const { error } = await supabase.from("workers").update(row).eq("id", input.id);
    if (error) return { ok: false, error: error.code === "23505" ? "รหัสพนักงานซ้ำ" : error.message };
  } else {
    const { error } = await supabase.from("workers").insert(row);
    if (error) return { ok: false, error: error.code === "23505" ? "รหัสพนักงานซ้ำ" : error.message };
  }
  revalidatePath("/admin/workers");
  return { ok: true };
}

export async function setWorkerActive(id: string, on: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("workers").update({ active: on }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/workers");
  return { ok: true };
}
