import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminActor } from "@/lib/wheels/role";
import type { WorkerRole } from "@/lib/wheels/types";
import { WHEELS_WORKER_FUNCTIONS } from "@/lib/wheels/worker-functions";
import { WorkerAccessClient } from "@/components/wheels/worker-access-client";

/** Admin-only: manage worker roles + which roles may use each SC Wheels worker function. */
export default async function WorkerAccessPage() {
  const { isAdmin } = await getAdminActor();
  if (!isAdmin) redirect("/admin/wheels");

  const supabase = await createClient();
  const [roles, maps, workers] = await Promise.all([
    supabase.from("worker_roles").select("*").order("sort"),
    supabase.from("wheels_function_roles").select("function_key, role_id"),
    supabase.from("workers").select("role_id"),
  ]);

  const workerCounts: Record<string, number> = {};
  for (const w of (workers.data ?? []) as { role_id: string | null }[]) {
    if (w.role_id) workerCounts[w.role_id] = (workerCounts[w.role_id] ?? 0) + 1;
  }

  return (
    <WorkerAccessClient
      roles={(roles.data ?? []) as WorkerRole[]}
      maps={(maps.data ?? []) as { function_key: string; role_id: string }[]}
      functions={WHEELS_WORKER_FUNCTIONS}
      workerCounts={workerCounts}
    />
  );
}
