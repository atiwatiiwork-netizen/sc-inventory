"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminActor } from "@/lib/wheels/role";

export type ReceiveLine = { raw_id: string; qty: number };
export type ReceiveResult = { ok: boolean; error?: string; count?: number };

/** Receive raw wheels from a supplier into raw inventory (atomic RPC). */
export async function receiveRaw(input: { date: string; note: string; lines: ReceiveLine[] }): Promise<ReceiveResult> {
  const lines = input.lines.filter((l) => l.raw_id && l.qty > 0);
  if (lines.length === 0) return { ok: false, error: "ยังไม่ได้กรอกจำนวน" };

  const { by } = await getAdminActor();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("wheels_receive_raw", {
    p_date: input.date,
    p_note: input.note || "",
    p_by: by,
    p_lines: lines,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/wheels/receiving");
  revalidatePath("/admin/wheels/raw");
  revalidatePath("/admin/wheels");
  return { ok: true, count: (data as number) ?? lines.length };
}
