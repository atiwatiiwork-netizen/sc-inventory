"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminActor } from "@/lib/wheels/role";
import { WORK_PLAN_STATUSES, type WorkPlanProductKind, type WorkPlanStatus } from "@/lib/wheels/work-plan";

export type ActionResult = { ok: boolean; error?: string };

export type WorkPlanInput = {
  id?: string; // present when editing
  plan_date: string;
  product_kind: WorkPlanProductKind;
  product_id: string;
  sku: string;
  display_name: string;
  quantity: number;
  unit: string;
  note: string;
  status?: WorkPlanStatus; // edit only
};

const revalidate = () => {
  revalidatePath("/admin/wheels/work-plan");
  revalidatePath("/admin/wheels");
};

/** One line for the Low Stock picker bulk-add. Quantity is entered by the human. */
export type BulkPlanLine = {
  product_kind: WorkPlanProductKind;
  product_id: string;
  sku: string;
  display_name: string;
  quantity: number;
  unit: string;
};

/**
 * Add several work-plan items at once (from the Low Stock SKU picker). The human
 * has already chosen the SKUs and typed each quantity — the system generates
 * nothing. Lines with quantity ≤ 0 are skipped. Information only.
 */
export async function addWorkPlanItemsBulk(plan_date: string, lines: BulkPlanLine[]): Promise<{ ok: boolean; created: number; error?: string }> {
  if (!plan_date) return { ok: false, created: 0, error: "กรุณาเลือกวันที่" };
  const valid = lines.filter((l) => l.product_id && l.sku.trim() && l.quantity > 0);
  if (valid.length === 0) return { ok: false, created: 0, error: "กรุณาเลือกสินค้าและกรอกจำนวนอย่างน้อย 1 รายการ" };

  const supabase = await createClient();
  const { by } = await getAdminActor();

  const rows = valid.map((l) => ({
    plan_date,
    product_kind: l.product_kind,
    product_id: l.product_id,
    sku: l.sku.trim(),
    display_name: l.display_name.trim() || l.sku.trim(),
    quantity: l.quantity,
    unit: l.unit.trim() || "หน่วย",
    status: "planned",
    created_by: by,
    updated_by: by,
  }));

  const { error } = await supabase.from("wheels_work_plan_items").insert(rows);
  if (error) return { ok: false, created: 0, error: error.message };

  revalidate();
  return { ok: true, created: rows.length };
}

/** Create or edit a work-plan item. Information only — never touches stock. */
export async function saveWorkPlanItem(input: WorkPlanInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { by } = await getAdminActor();

  if (!input.plan_date) return { ok: false, error: "กรุณาเลือกวันที่" };
  if (!input.product_id || !input.sku.trim()) return { ok: false, error: "กรุณาเลือกสินค้า" };
  if (!(input.quantity > 0)) return { ok: false, error: "จำนวนต้องมากกว่า 0" };

  const base = {
    plan_date: input.plan_date,
    product_kind: input.product_kind,
    product_id: input.product_id,
    sku: input.sku.trim(),
    display_name: input.display_name.trim() || input.sku.trim(),
    quantity: input.quantity,
    unit: input.unit.trim() || "หน่วย",
    note: input.note.trim() || null,
  };

  if (input.id) {
    const status = input.status && WORK_PLAN_STATUSES.includes(input.status) ? input.status : undefined;
    const { error } = await supabase
      .from("wheels_work_plan_items")
      .update({
        ...base,
        ...(status ? { status, cancelled_at: status === "cancelled" ? new Date().toISOString() : null } : {}),
        updated_by: by,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("wheels_work_plan_items").insert({
      ...base,
      status: "planned",
      created_by: by,
      updated_by: by,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidate();
  return { ok: true };
}

/** Quick status change (mark in progress / done / cancel / reopen). */
export async function setWorkPlanStatus(id: string, status: WorkPlanStatus): Promise<ActionResult> {
  if (!WORK_PLAN_STATUSES.includes(status)) return { ok: false, error: "สถานะไม่ถูกต้อง" };
  const supabase = await createClient();
  const { by } = await getAdminActor();

  const { error } = await supabase
    .from("wheels_work_plan_items")
    .update({
      status,
      cancelled_at: status === "cancelled" ? new Date().toISOString() : null,
      updated_by: by,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}
