import { createClient } from "@/lib/supabase/server";
import type { Worker } from "@/lib/types";
import { WorkersClient } from "@/components/workers-client";

export default async function WorkersPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("workers").select("*").order("code");
  return <WorkersClient workers={(data ?? []) as Worker[]} />;
}
