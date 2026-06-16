// SC Wheels — Work Plan v1 shared types + status metadata (Phase 5).
// PURE module (no server imports) so both the client UI and server code can use it.
// Mirrors supabase/wheels-phase5.sql. The Work Plan is INFORMATION ONLY — it never
// affects stock, transactions, production or raw materials.

export const WORK_PLAN_STATUSES = ["planned", "in_progress", "done", "cancelled"] as const;
export type WorkPlanStatus = (typeof WORK_PLAN_STATUSES)[number];

export type WorkPlanProductKind = "box" | "assembly";

/** One row of wheels_work_plan_items. */
export type WorkPlanItem = {
  id: string;
  plan_date: string;
  product_kind: WorkPlanProductKind;
  product_id: string;
  sku: string;
  display_name: string;
  quantity: number;
  unit: string;
  status: WorkPlanStatus;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
};

/**
 * Display metadata for each status: Thai label, English sub, pill colour class,
 * and a solid `accent` CSS var used for the row status-stripe (quick scanning).
 */
export const STATUS_META: Record<WorkPlanStatus, { th: string; en: string; pill: string; accent: string }> = {
  planned: { th: "วางแผนไว้", en: "Planned", pill: "blue", accent: "var(--accent)" },
  in_progress: { th: "กำลังทำ", en: "In progress", pill: "amber", accent: "var(--amber-ink)" },
  done: { th: "เสร็จแล้ว", en: "Done", pill: "green", accent: "var(--green-ink)" },
  cancelled: { th: "ยกเลิก", en: "Cancelled", pill: "grey", accent: "var(--ink-4)" },
};

/**
 * Whether a SKU is planned for a date, and the active planned quantity/statuses.
 * Cancelled items are excluded. Built for later PAC v2 reuse.
 */
export type WorkPlanSummary = {
  planned: boolean;
  totalQuantity: number;
  unit: string | null;
  statuses: WorkPlanStatus[];
};

/** Summarize a set of work-plan rows (all assumed same SKU+date). Ignores cancelled. */
export function summarizeWorkPlan(items: WorkPlanItem[]): WorkPlanSummary {
  const active = items.filter((i) => i.status !== "cancelled");
  return {
    planned: active.length > 0,
    totalQuantity: active.reduce((s, i) => s + i.quantity, 0),
    unit: active[0]?.unit ?? null,
    statuses: Array.from(new Set(active.map((i) => i.status))),
  };
}
