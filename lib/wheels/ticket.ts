// SC Wheels — Production Ticket v1 shared types + pure helpers (Phase 7).
// PURE module (no server imports). Mirrors supabase/wheels-phase7.sql.
//
// A ticket is a human-reviewed REQUEST. Nothing here reserves/deducts stock,
// creates production, or schedules anything — it is passive decision support.

export const TICKET_STATUSES = ["open", "in_review", "accepted", "rejected", "done", "cancelled"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_SOURCES = ["stock_check", "manual"] as const;
export type TicketSource = (typeof TICKET_SOURCES)[number];

export const TIMING_KINDS = ["now", "today", "within_hours", "custom"] as const;
export type TimingKind = (typeof TIMING_KINDS)[number];

export type TicketProductKind = "box" | "assembly";

export type ProductionTicket = {
  id: string;
  ticket_date: string;
  source: TicketSource;
  product_kind: TicketProductKind;
  product_id: string;
  sku: string;
  display_name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  requested_qty: number;
  suggested_qty: number;
  timing_kind: TimingKind;
  timing_date: string | null;
  timing_hours: number | null;
  note: string | null;
  status: TicketStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Editable ticket payload shared by the Stock Ready Check, the admin form, and both create actions. */
export type TicketDraft = {
  source: TicketSource;
  product_kind: TicketProductKind;
  product_id: string;
  sku: string;
  display_name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  requested_qty: number;
  suggested_qty: number;
  timing_kind: TimingKind;
  timing_date: string | null;
  timing_hours: number | null;
  note: string;
};

export const STATUS_META: Record<TicketStatus, { th: string; en: string; pill: string }> = {
  open: { th: "เปิดอยู่", en: "Open", pill: "blue" },
  in_review: { th: "กำลังตรวจ", en: "In review", pill: "amber" },
  accepted: { th: "รับเรื่อง", en: "Accepted", pill: "green" },
  rejected: { th: "ปฏิเสธ", en: "Rejected", pill: "red" },
  done: { th: "เสร็จแล้ว", en: "Done", pill: "green" },
  cancelled: { th: "ยกเลิก", en: "Cancelled", pill: "grey" },
};

export const SOURCE_TH: Record<TicketSource, string> = {
  stock_check: "เช็คสต็อกพร้อมขาย",
  manual: "สร้างเอง",
};

/** Human label for a desired-timing choice. */
export function timingLabel(kind: TimingKind, date: string | null, hours: number | null): string {
  switch (kind) {
    case "now":
      return "เดี๋ยวนี้";
    case "today":
      return "ภายในวันนี้";
    case "within_hours":
      return `ภายใน ${hours ?? "?"} ชั่วโมง`;
    case "custom":
      return date ? `ภายในวันที่ ${date}` : "กำหนดวันเอง";
  }
}

/* ---- Availability (Stock Ready Check) -------------------------------------
 * Simple, explicit rules — no optimisation, no AI:
 *   red    : stock is 0, or the request exceeds what is on hand
 *   yellow : request is ≥ 50% of stock, OR stock after the request dips below
 *            the minimum, OR stock is already at/below minimum
 *   green  : request < 50% of stock AND stock is above minimum
 * ------------------------------------------------------------------------- */
export type Availability = "green" | "yellow" | "red";

export function evaluateAvailability(stock: number, minStock: number, requested: number): Availability {
  if (stock <= 0 || requested > stock) return "red";
  const remaining = stock - requested;
  const halfOrMore = requested * 2 >= stock; // requested ≥ 50% of stock
  const belowMinAfter = minStock > 0 && remaining < minStock;
  const stockAtOrBelowMin = minStock > 0 && stock <= minStock;
  return halfOrMore || belowMinAfter || stockAtOrBelowMin ? "yellow" : "green";
}

export const AVAILABILITY_META: Record<Availability, { th: string; pill: string; color: string }> = {
  green: { th: "สินค้ามีปริมาณเพียงพอ", pill: "green", color: "var(--green-ink)" },
  yellow: { th: "สินค้ายังมีปริมาณเพียงพอ แต่เริ่มระวังเรื่องสต๊อก", pill: "amber", color: "var(--amber-ink)" },
  red: { th: "สินค้าหมด กรุณาออกตั๋วส่งผลิต", pill: "red", color: "var(--red-ink)" },
};

/**
 * Informational starter refill quantity (NOT a production order):
 * the larger of (minimum − current) and (requested − current), never below 0.
 * Labelled "จำนวนที่ควรทำเติมเบื้องต้น"; the human edits it before saving.
 */
export function suggestRefill(stock: number, minStock: number, requested: number): number {
  return Math.max(0, minStock - stock, requested - stock);
}
