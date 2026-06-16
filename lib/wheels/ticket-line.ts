import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { getLineSettings } from "@/lib/settings";
import { pushText } from "@/lib/line/client";
import { timingLabel, type TimingKind } from "@/lib/wheels/ticket";

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
