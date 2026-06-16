import { createClient } from "@/lib/supabase/server";
import type { Worker } from "@/lib/types";
import type { WorkerRole } from "@/lib/wheels/types";
import { WorkersClient } from "@/components/workers-client";

export default async function WorkersPage() {
  const supabase = await createClient();
  const [workers, roles] = await Promise.all([
    supabase.from("workers").select("*").order("code"),
    supabase.from("worker_roles").select("*").eq("active", true).order("sort"),
  ]);
  return <WorkersClient workers={(workers.data ?? []) as Worker[]} roles={(roles.data ?? []) as WorkerRole[]} />;
}
