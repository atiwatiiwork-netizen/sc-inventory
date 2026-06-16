import { createClient } from "@/lib/supabase/server";
import { loadWorkPlanView } from "@/lib/wheels/work-plan-view";
import { WorkPlanClient } from "@/components/wheels/work-plan-client";

/**
 * SC Wheels — Work Plan v1 (Phase 5) + passive context (Phase 6/7). Owner/admin
 * record what the factory should focus on Today / Tomorrow; everyone sees the same
 * intent. INFORMATION ONLY — never affects stock, transactions, production or sales.
 *
 * Data comes from the shared loadWorkPlanView() so the admin and worker-side
 * (read-only) pages render the exact same business view.
 */
export default async function WorkPlanPage() {
  const supabase = await createClient();
  const view = await loadWorkPlanView(supabase);

  return (
    <WorkPlanClient
      items={view.items}
      products={view.products}
      contextById={view.contextById}
      lowStock={view.lowStock}
      today={view.today}
      tomorrow={view.tomorrow}
    />
  );
}
