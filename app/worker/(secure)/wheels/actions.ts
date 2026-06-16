"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getWorkerSession } from "@/lib/worker-session";
import { canUseWheelsFunction } from "@/lib/wheels/worker-access";
import type { MovementResult, Shortage } from "@/lib/wheels/types";
import type { SaleLine } from "@/app/admin/(console)/wheels/sales/actions";

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

/**
 * Worker-side sale entry. REUSES the existing sales transaction model — the same
 * `wheels_record_sale` RPC, the same soft-block-on-shortage behaviour. It does NOT
 * change inventory deduction, commit/void, or any sales logic.
 *
 * Permission-gated: requires the 'wheels-sales' worker function (default-CLOSED,
 * so the owner must grant it to a role). Workers can never sell raw wheels and can
 * never override a shortage — those stay admin-only, exactly as on the office path.
 * The signature matches the admin `recordSale` so SalesClient can call either; the
 * admin-only fields (allowRaw/override/reason) are ignored here.
 */
export async function submitWorkerSale(input: {
  date: string;
  customer: string;
  note: string;
  lines: SaleLine[];
  allowRaw?: boolean;
  override?: boolean;
  reason?: string;
}): Promise<MovementResult> {
  const session = await getWorkerSession();
  if (!session) return { ok: false, error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "ยังไม่ได้ตั้งค่า Supabase — ดูไฟล์ README" };
  if (!(await canUseWheelsFunction(session.id, "wheels-sales"))) {
    return { ok: false, error: "บัญชีของคุณไม่ได้รับสิทธิ์บันทึกการขาย — ติดต่อผู้ดูแล" };
  }

  const lines = input.lines.filter((l) => l.ref_id && l.qty > 0);
  if (lines.length === 0) return { ok: false, error: "ยังไม่ได้กรอกจำนวน" };
  if (lines.some((l) => l.layer === "raw")) {
    return { ok: false, error: "การขายล้อดิบทำได้เฉพาะผู้ดูแล (admin)" };
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("wheels_record_sale", {
    p_by: session.code,
    p_date: input.date,
    p_customer: input.customer || null,
    p_note: input.note || null,
    p_items: lines,
    p_allow_raw: false, // workers never sell raw
    p_override: false, // workers never override a shortage
    p_override_by: null,
    p_reason: null,
  });
  if (error) return { ok: false, error: error.message };

  const res = data as { status: string; shortages?: Shortage[] };
  if (res.status === "shortage") return { ok: false, shortages: res.shortages ?? [] };

  revalidatePath("/worker/wheels/sales");
  return { ok: true };
}
