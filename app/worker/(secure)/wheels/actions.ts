"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getWorkerSession } from "@/lib/worker-session";
import type { MovementResult, Shortage } from "@/lib/wheels/types";

export type ProdItem = { ref_id: string; qty: number };

/**
 * Commit a worker's daily production for ONE kind ('pack' or 'assemble').
 * Workers enter finished outputs only; the RPC computes every deduction
 * (units_per_box / BOM) automatically. Workers can never override — a shortage
 * is reported back so the UI can soft-block. Re-submitting the same day edits it.
 */
export async function submitProduction(input: {
  date: string;
  kind: "pack" | "assemble";
  noProduction: boolean;
  items: ProdItem[];
}): Promise<MovementResult> {
  const session = await getWorkerSession();
  if (!session) return { ok: false, error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "ยังไม่ได้ตั้งค่า Supabase — ดูไฟล์ README" };

  const items = input.noProduction
    ? []
    : input.items
        .filter((l) => l.ref_id && l.qty > 0)
        .map((l) => (input.kind === "pack" ? { box_id: l.ref_id, qty: l.qty } : { assembly_id: l.ref_id, qty: l.qty }));

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("wheels_submit_production", {
    p_worker: session.id,
    p_date: input.date,
    p_kind: input.kind,
    p_no_production: input.noProduction,
    p_items: items,
    p_override: false,
    p_override_by: null,
    p_reason: null,
  });
  if (error) return { ok: false, error: error.message };

  const res = data as { status: string; shortages?: Shortage[] };
  if (res.status === "shortage") return { ok: false, shortages: res.shortages ?? [] };

  revalidatePath("/worker/wheels/packing");
  revalidatePath("/worker/wheels/assembly");
  return { ok: true };
}
