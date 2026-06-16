"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminActor } from "@/lib/wheels/role";
import type { InventoryLayer, MovementResult, Shortage } from "@/lib/wheels/types";

export type SaleLine = { layer: InventoryLayer; ref_id: string; qty: number };

/**
 * Record an office sale. Standard sales cover box + assembly; raw-wheel sales are
 * the admin-only exception (`allowRaw`). A shortage soft-blocks unless an admin
 * confirms with `override` + a required `reason`. Both raw-sales and override are
 * gated server-side to `profiles.role === 'admin'`.
 */
export async function recordSale(input: {
  date: string;
  customer: string;
  note: string;
  lines: SaleLine[];
  allowRaw?: boolean;
  override?: boolean;
  reason?: string;
}): Promise<MovementResult> {
  const lines = input.lines.filter((l) => l.ref_id && l.qty > 0);
  if (lines.length === 0) return { ok: false, error: "ยังไม่ได้กรอกจำนวน" };

  const { by, isAdmin } = await getAdminActor();
  const allowRaw = !!input.allowRaw && isAdmin;
  const override = !!input.override && isAdmin;

  if (lines.some((l) => l.layer === "raw") && !allowRaw) {
    return { ok: false, error: "การขายล้อดิบทำได้เฉพาะผู้ดูแล (admin)" };
  }
  if (input.override && !isAdmin) {
    return { ok: false, error: "เฉพาะผู้ดูแล (admin) เท่านั้นที่ข้ามคำเตือนได้" };
  }
  if (override && !input.reason?.trim()) {
    return { ok: false, error: "กรุณาระบุเหตุผลในการข้ามคำเตือน" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("wheels_record_sale", {
    p_by: by,
    p_date: input.date,
    p_customer: input.customer || null,
    p_note: input.note || null,
    p_items: lines,
    p_allow_raw: allowRaw,
    p_override: override,
    p_override_by: by,
    p_reason: input.reason || null,
  });
  if (error) return { ok: false, error: error.message };

  const res = data as { status: string; shortages?: Shortage[] };
  if (res.status === "shortage") return { ok: false, shortages: res.shortages ?? [] };

  revalidatePath("/admin/wheels/sales");
  revalidatePath("/admin/wheels/raw-sales");
  revalidatePath("/admin/wheels");
  return { ok: true };
}
