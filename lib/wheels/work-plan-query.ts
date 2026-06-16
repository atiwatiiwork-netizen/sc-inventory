import "server-only";
import { createClient } from "@/lib/supabase/server";
import { summarizeWorkPlan, type WorkPlanItem, type WorkPlanSummary } from "./work-plan";

/**
 * PAC integration helper (Phase 5 prep). For a given finished-good SKU and date,
 * return whether it is in the work plan and the active planned quantity/statuses.
 * Read-only; cancelled items are excluded. Intended for later PAC v2 reuse.
 */
export async function getWorkPlanForSku(sku: string, date: string): Promise<WorkPlanSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wheels_work_plan_items")
    .select("*")
    .eq("sku", sku)
    .eq("plan_date", date)
    .neq("status", "cancelled");
  return summarizeWorkPlan((data ?? []) as WorkPlanItem[]);
}
