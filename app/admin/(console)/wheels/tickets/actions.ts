"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminActor } from "@/lib/wheels/role";
import { TICKET_STATUSES, type TicketDraft, type TicketStatus, type ProductionTicket } from "@/lib/wheels/ticket";
import { sendTicketLine } from "@/lib/wheels/ticket-line";

export type TicketResult = { ok: boolean; error?: string; lineSent?: boolean; lineError?: string };

const revalidate = () => {
  revalidatePath("/admin/wheels/tickets");
  revalidatePath("/admin/wheels");
};

/** Create a production ticket (manual or carried from a stock check). Office/admin path. */
export async function createTicket(draft: TicketDraft, sendLine = false): Promise<TicketResult> {
  if (!draft.product_id || !draft.sku.trim()) return { ok: false, error: "กรุณาเลือกสินค้า" };
  const supabase = await createClient();
  const { by } = await getAdminActor();

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
    created_by: by,
    updated_by: by,
  });
  if (error) return { ok: false, error: error.message };

  let lineSent: boolean | undefined;
  let lineError: string | undefined;
  if (sendLine) {
    const r = await sendTicketLine({
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
    lineSent = r.ok;
    lineError = r.ok ? undefined : r.error;
  }

  revalidate();
  return { ok: true, lineSent, lineError };
}

/** Manual status change (no automatic transitions). */
export async function setTicketStatus(id: string, status: TicketStatus): Promise<TicketResult> {
  if (!TICKET_STATUSES.includes(status)) return { ok: false, error: "สถานะไม่ถูกต้อง" };
  const supabase = await createClient();
  const { by } = await getAdminActor();
  const { error } = await supabase
    .from("wheels_production_tickets")
    .update({ status, updated_by: by, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Optional LINE notification for an existing ticket. */
export async function sendLineForTicket(id: string): Promise<TicketResult> {
  const supabase = await createClient();
  const { data } = await supabase.from("wheels_production_tickets").select("*").eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "ไม่พบตั๋ว" };
  const t = data as ProductionTicket;
  const r = await sendTicketLine({
    displayName: t.display_name,
    sku: t.sku,
    currentStock: t.current_stock,
    unit: t.unit,
    requestedQty: t.requested_qty,
    suggestedQty: t.suggested_qty,
    ticketDate: t.ticket_date,
    timingKind: t.timing_kind,
    timingDate: t.timing_date,
    timingHours: t.timing_hours,
    note: t.note,
    by: t.created_by,
  });
  return { ok: r.ok, error: r.ok ? undefined : r.error, lineSent: r.ok, lineError: r.ok ? undefined : r.error };
}
