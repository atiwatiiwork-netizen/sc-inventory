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

/** Factory-floor execution status (Phase 8), orthogonal to the office `status`. */
export const WORK_STATUSES = ["waiting", "in_progress", "done"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

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
  // Phase 8 — worker execution lifecycle.
  work_status: WorkStatus;
  started_at: string | null;
  started_by: string | null;
  finished_at: string | null;
  finished_by: string | null;
};

/** Worker job-board status metadata (3 states only). */
export const WORK_STATUS_META: Record<WorkStatus, { th: string; pill: string }> = {
  waiting: { th: "รอเริ่มงาน", pill: "blue" },
  in_progress: { th: "กำลังทำ", pill: "amber" },
  done: { th: "เสร็จงานแล้ว", pill: "green" },
};

/** Major product category for the job board. Derived from the existing product_kind. */
export type ProductCategory = "wheel" | "assembly";
export const CATEGORY_TH: Record<ProductCategory, string> = { wheel: "ลูกล้อ", assembly: "งานประกอบ / ล้อชุด" };
export const categoryOfKind = (kind: TicketProductKind): ProductCategory => (kind === "assembly" ? "assembly" : "wheel");

/**
 * Urgency sort key for WAITING tickets — lower = more urgent. Uses ONLY the
 * explicit requested timing (no AI, no demand prediction):
 *   now → within xx hours (fewer first) → today → specific date (nearest first) → none.
 */
export function urgencyKey(t: Pick<ProductionTicket, "timing_kind" | "timing_date" | "timing_hours">): number {
  switch (t.timing_kind) {
    case "now":
      return 0;
    case "within_hours":
      return 1_000_000 + (t.timing_hours ?? 9_999);
    case "today":
      return 2_000_000;
    case "custom":
      return t.timing_date ? 3_000_000 + Math.floor(Date.parse(`${t.timing_date}T00:00:00Z`) / 86_400_000) : 9_000_000;
    default:
      return 9_000_000;
  }
}

/** Whether a waiting ticket should carry the subtle "urgent" accent (now / within hours). */
export function isUrgent(t: Pick<ProductionTicket, "timing_kind">): boolean {
  return t.timing_kind === "now" || t.timing_kind === "within_hours";
}

/**
 * Urgency badge derived ONLY from the explicit requested timing (no AI, no
 * stock inference). `urgent` drives the subtle left-border accent.
 */
export function urgencyBadge(t: Pick<ProductionTicket, "timing_kind" | "timing_date" | "timing_hours">): { label: string; pill: string; urgent: boolean } {
  switch (t.timing_kind) {
    case "now":
      return { label: "ด่วนมาก", pill: "red", urgent: true };
    case "within_hours":
      return { label: `ด่วนใน ${t.timing_hours ?? "?"} ชม.`, pill: "red", urgent: true };
    case "today":
      return { label: "ด่วนวันนี้", pill: "amber", urgent: false };
    case "custom":
      return t.timing_date ? { label: `กำหนด ${t.timing_date}`, pill: "blue", urgent: false } : { label: "ไม่ระบุเวลา", pill: "grey", urgent: false };
    default:
      return { label: "ไม่ระบุเวลา", pill: "grey", urgent: false };
  }
}

/** Human duration between two ISO timestamps, e.g. "2 ชม. 15 นาที". */
export function formatDuration(startISO: string | null, finishISO: string | null): string | null {
  if (!startISO || !finishISO) return null;
  const ms = Date.parse(finishISO) - Date.parse(startISO);
  if (!(ms >= 0)) return null;
  const mins = Math.round(ms / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} นาที`;
  return m === 0 ? `${h} ชม.` : `${h} ชม. ${m} นาที`;
}

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
