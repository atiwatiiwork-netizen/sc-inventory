"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getWorkerSession } from "@/lib/worker-session";
import { canUseWheelsFunction } from "@/lib/wheels/worker-access";
import type { MovementResult, Shortage } from "@/lib/wheels/types";
import type { SaleLine } from "@/app/admin/(console)/wheels/sales/actions";
import { categoryOfKind, formatDuration, type TicketDraft, type ProductionTicket } from "@/lib/wheels/ticket";
import { sendTicketLine, sendJobLine } from "@/lib/wheels/ticket-line";

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

export type TicketResult = { ok: boolean; error?: string; lineSent?: boolean; lineError?: string };

/**
 * Worker-side production ticket. Permission-gated by 'wheels-production-ticket'
 * (default-CLOSED). Stores a human-reviewed REQUEST only — it never reserves or
 * deducts stock, creates production, or schedules anything. LINE is optional and
 * never blocks the save.
 */
export async function createWorkerTicket(draft: TicketDraft, sendLine = false): Promise<TicketResult> {
  const session = await getWorkerSession();
  if (!session) return { ok: false, error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "ยังไม่ได้ตั้งค่า Supabase — ดูไฟล์ README" };
  if (!(await canUseWheelsFunction(session.id, "wheels-production-ticket"))) {
    return { ok: false, error: "บัญชีของคุณไม่ได้รับสิทธิ์ออกตั๋วสั่งผลิต — ติดต่อผู้ดูแล" };
  }
  if (!draft.product_id || !draft.sku.trim()) return { ok: false, error: "ไม่พบสินค้า" };

  const supabase = createServiceClient();
  const { error } = await supabase.from("wheels_production_tickets").insert({
    source: draft.source,
    product_kind: draft.product_kind,
    product_id: draft.product_id,
    sku: draft.sku.trim(),
    display_name: draft.display_name.trim() || draft.sku.trim(),
    unit: draft.unit.trim() || "หน่วย",
    current_stock: draft.current_stock,
    min_stock: draft.min_stock,
    requested_qty: Math.max(0, draft.requested_qty),
    suggested_qty: Math.max(0, draft.suggested_qty),
    timing_kind: draft.timing_kind,
    timing_date: draft.timing_kind === "custom" ? draft.timing_date : null,
    timing_hours: draft.timing_kind === "within_hours" ? draft.timing_hours : null,
    note: draft.note.trim() || null,
    status: "open",
    created_by: session.code,
    updated_by: session.code,
  });
  if (error) return { ok: false, error: error.message };

  let lineSent: boolean | undefined;
  let lineError: string | undefined;
  if (sendLine) {
    const r = await sendLineForDraft(draft, session.code);
    lineSent = r.ok;
    lineError = r.ok ? undefined : r.error;
  }

  revalidatePath("/worker/wheels/stock-check");
  revalidatePath("/admin/wheels/tickets");
  return { ok: true, lineSent, lineError };
}

/** Standalone LINE alert from the Stock Ready Check (no ticket). Permission-gated. */
export async function notifyWorkerStockLine(draft: TicketDraft): Promise<{ ok: boolean; error?: string }> {
  const session = await getWorkerSession();
  if (!session) return { ok: false, error: "เซสชันหมดอายุ" };
  if (!(await canUseWheelsFunction(session.id, "wheels-production-ticket"))) {
    return { ok: false, error: "บัญชีของคุณไม่ได้รับสิทธิ์ส่งแจ้งเตือน — ติดต่อผู้ดูแล" };
  }
  return sendLineForDraft(draft, session.code);
}

function sendLineForDraft(draft: TicketDraft, by: string) {
  return sendTicketLine({
    displayName: draft.display_name,
    sku: draft.sku,
    currentStock: draft.current_stock,
    unit: draft.unit,
    requestedQty: draft.requested_qty,
    suggestedQty: draft.suggested_qty,
    ticketDate: new Date().toISOString().slice(0, 10),
    timingKind: draft.timing_kind,
    timingDate: draft.timing_date,
    timingHours: draft.timing_hours,
    note: draft.note,
    by,
  });
}

/* ---- Worker Job Ticket board (Phase 8) ----------------------------------
 * Progressing a job ticket's work_status is communication/visibility ONLY:
 * it never deducts stock, creates production transactions, touches BOM/sales,
 * or the Work Plan. Gated by the 'wheels-job-ticket' function.
 * ------------------------------------------------------------------------- */
const jobQty = (t: Pick<ProductionTicket, "suggested_qty" | "requested_qty">) => t.suggested_qty || t.requested_qty;

async function loadTicketForJob(id: string) {
  const session = await getWorkerSession();
  if (!session) return { error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" as const };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "ยังไม่ได้ตั้งค่า Supabase — ดูไฟล์ README" as const };
  if (!(await canUseWheelsFunction(session.id, "wheels-job-ticket"))) {
    return { error: "บัญชีของคุณไม่ได้รับสิทธิ์ใช้งานตั๋วสั่งงาน — ติดต่อผู้ดูแล" as const };
  }
  const supabase = createServiceClient();
  const { data } = await supabase.from("wheels_production_tickets").select("*").eq("id", id).maybeSingle();
  if (!data) return { error: "ไม่พบตั๋ว" as const };
  return { session, supabase, ticket: data as ProductionTicket };
}

/** Mark a job ticket "กำลังทำ": save start timestamp + actor, then (optional) LINE. */
export async function startJob(id: string): Promise<TicketResult> {
  const r = await loadTicketForJob(id);
  if ("error" in r) return { ok: false, error: r.error };
  const { session, supabase, ticket } = r;
  if (ticket.work_status !== "waiting") return { ok: false, error: "ตั๋วนี้เริ่มงานไปแล้ว" };

  const startedAt = new Date().toISOString();
  const { error } = await supabase
    .from("wheels_production_tickets")
    .update({ work_status: "in_progress", started_at: startedAt, started_by: session.code, updated_by: session.code, updated_at: startedAt })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  const lr = await sendJobLine("start", {
    displayName: ticket.display_name,
    category: categoryOfKind(ticket.product_kind),
    quantity: jobQty(ticket),
    unit: ticket.unit,
    startedAt,
    startedBy: session.code,
  });
  revalidatePath("/worker/wheels/job-ticket");
  revalidatePath("/admin/wheels/tickets");
  return { ok: true, lineSent: lr.ok, lineError: lr.ok ? undefined : lr.error };
}

/** Mark a job ticket "เสร็จงานแล้ว": save finish timestamp + duration, then (optional) LINE. */
export async function finishJob(id: string): Promise<TicketResult> {
  const r = await loadTicketForJob(id);
  if ("error" in r) return { ok: false, error: r.error };
  const { session, supabase, ticket } = r;
  if (ticket.work_status === "done") return { ok: false, error: "ตั๋วนี้เสร็จงานแล้ว" };

  const finishedAt = new Date().toISOString();
  const startedAt = ticket.started_at ?? finishedAt; // safety: allow finishing a not-yet-started ticket
  const { error } = await supabase
    .from("wheels_production_tickets")
    .update({ work_status: "done", started_at: ticket.started_at ?? startedAt, finished_at: finishedAt, finished_by: session.code, updated_by: session.code, updated_at: finishedAt })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  const lr = await sendJobLine("finish", {
    displayName: ticket.display_name,
    category: categoryOfKind(ticket.product_kind),
    quantity: jobQty(ticket),
    unit: ticket.unit,
    startedAt,
    startedBy: ticket.started_by,
    finishedAt,
    finishedBy: session.code,
    duration: formatDuration(startedAt, finishedAt),
  });
  revalidatePath("/worker/wheels/job-ticket");
  revalidatePath("/admin/wheels/tickets");
  return { ok: true, lineSent: lr.ok, lineError: lr.ok ? undefined : lr.error };
}
