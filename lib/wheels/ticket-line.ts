import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { getLineSettings } from "@/lib/settings";
import { pushText } from "@/lib/line/client";
import { timingLabel, CATEGORY_TH, type TimingKind, type ProductCategory } from "@/lib/wheels/ticket";

export type TicketLineFields = {
  displayName: string;
  sku: string;
  currentStock: number;
  unit: string;
  requestedQty: number;
  suggestedQty: number;
  ticketDate: string;
  timingKind: TimingKind;
  timingDate: string | null;
  timingHours: number | null;
  note?: string | null;
  by?: string | null;
};

/** Whether LINE is configured well enough to send (no secrets returned). */
export async function isLineReady(): Promise<boolean> {
  const s = await getLineSettings(createServiceClient());
  return !!(s.enabled && s.token && s.recipientId);
}

function buildMessage(f: TicketLineFields): string {
  const lines = [
    "🏭 แจ้งเตือนสั่งผลิต (SC Wheels)",
    `สินค้า: ${f.displayName}`,
    `SKU: ${f.sku}`,
    `สต็อกปัจจุบัน: ${f.currentStock.toLocaleString()} ${f.unit}`,
    `ลูกค้าขอ: ${f.requestedQty.toLocaleString()} ${f.unit}`,
    `ควรทำเติมเบื้องต้น: ${f.suggestedQty.toLocaleString()} ${f.unit}`,
    `กำหนด: ${timingLabel(f.timingKind, f.timingDate, f.timingHours)}`,
    `วันที่ตั๋ว: ${f.ticketDate}`,
  ];
  if (f.note?.trim()) lines.push(`หมายเหตุ: ${f.note.trim()}`);
  if (f.by) lines.push(`โดย: ${f.by}`);
  return lines.join("\n");
}

/**
 * Optional LINE notification for a production ticket. Reuses the existing LINE
 * infrastructure (channel token + recipient from app_settings). Never throws and
 * never blocks ticket creation — callers treat a failure as a soft warning.
 */
export async function sendTicketLine(f: TicketLineFields): Promise<{ ok: boolean; error?: string }> {
  try {
    const s = await getLineSettings(createServiceClient());
    if (!s.enabled) return { ok: false, error: "การแจ้งเตือน LINE ถูกปิดอยู่" };
    if (!s.token || !s.recipientId) return { ok: false, error: "ยังไม่ได้ตั้งค่า LINE (token/ผู้รับ)" };
    return await pushText(s.token, s.recipientId, buildMessage(f));
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

const fmtTs = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }) : "—";

export type JobLineFields = {
  displayName: string;
  category: ProductCategory;
  quantity: number; // total quantity (sum across the grouped tickets, or the single ticket)
  unit: string;
  startedAt: string | null;
  startedBy: string | null;
  finishedAt?: string | null;
  finishedBy?: string | null;
  duration?: string | null;
  ticketCount?: number; // > 1 → grouped action (one combined message)
};

/**
 * Manual job-event LINE notification (งานเริ่มแล้ว / งานเสร็จแล้ว). Fired only on a
 * user's start/finish click — never on page load. Reuses the existing LINE infra
 * and never blocks the status change. A grouped action (ticketCount > 1) sends a
 * single combined message, not one per ticket.
 */
export async function sendJobLine(event: "start" | "finish", f: JobLineFields): Promise<{ ok: boolean; error?: string }> {
  try {
    const s = await getLineSettings(createServiceClient());
    if (!s.enabled || !s.token || !s.recipientId) return { ok: false, error: "LINE ยังไม่พร้อม" };
    const grouped = (f.ticketCount ?? 1) > 1;
    const lines = [
      event === "start" ? "▶️ งานเริ่มแล้ว (SC Wheels)" : "✅ งานเสร็จแล้ว (SC Wheels)",
      `สินค้า: ${f.displayName}`,
      `ประเภท: ${CATEGORY_TH[f.category]}`,
      grouped ? `รวม: ${f.quantity.toLocaleString()} ${f.unit}` : `จำนวน: ${f.quantity.toLocaleString()} ${f.unit}`,
    ];
    if (grouped) lines.push(`จาก ${f.ticketCount} ตั๋ว`);
    lines.push(`เริ่ม: ${fmtTs(f.startedAt)}${f.startedBy ? ` · ${f.startedBy}` : ""}`);
    if (event === "finish") {
      lines.push(`เสร็จ: ${fmtTs(f.finishedAt ?? null)}${f.finishedBy ? ` · ${f.finishedBy}` : ""}`);
      if (f.duration) lines.push(`ใช้เวลา: ${f.duration}`);
    }
    return await pushText(s.token, s.recipientId, lines.join("\n"));
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
