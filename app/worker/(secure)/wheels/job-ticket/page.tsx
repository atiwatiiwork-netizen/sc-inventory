import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/worker-session";
import { canUseWheelsFunction } from "@/lib/wheels/worker-access";
import { createServiceClient } from "@/lib/supabase/server";
import { categoryOfKind, type ProductionTicket } from "@/lib/wheels/ticket";
import { isLineReady } from "@/lib/wheels/ticket-line";
import { JobTicketClient, type JobCard } from "@/components/wheels/job-ticket-client";

/**
 * Worker Job Ticket board (Phase 8). Shows work ordered into the factory (from
 * the office Stock Ready Check or created manually) grouped by category and
 * floor status. Start/Finish update status + timestamps and (optionally) notify
 * LINE — communication/visibility ONLY; never touches stock, production, BOM,
 * sales, or the Work Plan. Reuses the Phase-7 wheels_production_tickets table.
 */
export default async function JobTicketPage() {
  const session = (await getWorkerSession())!;
  if (!(await canUseWheelsFunction(session.id, "wheels-job-ticket"))) redirect("/worker/wheels");

  const supabase = createServiceClient();
  const [tickets, lineReady] = await Promise.all([
    // Live job tickets only — exclude office-withdrawn (cancelled) and refused (rejected).
    supabase
      .from("wheels_production_tickets")
      .select("*")
      .not("status", "in", "(cancelled,rejected)")
      .order("created_at", { ascending: false })
      .limit(300),
    isLineReady(),
  ]);

  const cards: JobCard[] = ((tickets.data ?? []) as ProductionTicket[]).map((t) => ({
    id: t.id,
    productId: t.product_id,
    name: t.display_name,
    category: categoryOfKind(t.product_kind),
    quantity: t.suggested_qty || t.requested_qty,
    unit: t.unit,
    source: t.source,
    requestedQty: t.requested_qty,
    stockAtCreation: t.current_stock,
    createdAt: t.created_at,
    createdBy: t.created_by,
    timingKind: t.timing_kind,
    timingDate: t.timing_date,
    timingHours: t.timing_hours,
    workStatus: t.work_status,
    startedAt: t.started_at,
    startedBy: t.started_by,
    finishedAt: t.finished_at,
    finishedBy: t.finished_by,
    note: t.note,
  }));

  return (
    <div style={{ padding: "16px 14px 32px" }}>
      <JobTicketClient cards={cards} lineReady={lineReady} />
    </div>
  );
}
