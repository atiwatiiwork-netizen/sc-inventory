import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/worker-session";
import { canUseWheelsFunction } from "@/lib/wheels/worker-access";
import { createServiceClient } from "@/lib/supabase/server";
import { loadWorkPlanView } from "@/lib/wheels/work-plan-view";
import { WorkPlanClient } from "@/components/wheels/work-plan-client";

/**
 * Worker-side Work Plan — passive, READ-ONLY. Shows the same Today/Tomorrow plan
 * (and stock/crate context) as the admin console via the shared loadWorkPlanView,
 * with all add/edit/status controls hidden. Workers never change planning
 * decisions here; the owner/admin manages the plan in the console.
 */
export default async function WorkerWorkPlanPage() {
  const session = (await getWorkerSession())!; // layout guarantees non-null
  if (!(await canUseWheelsFunction(session.id, "wheels-work-plan"))) redirect("/worker/wheels");

  const supabase = createServiceClient();
  const view = await loadWorkPlanView(supabase);

  return (
    <div style={{ padding: "16px 14px 32px" }}>
      <WorkPlanClient
        items={view.items}
        products={view.products}
        contextById={view.contextById}
        lowStock={view.lowStock}
        today={view.today}
        tomorrow={view.tomorrow}
        readOnly
      />
    </div>
  );
}
