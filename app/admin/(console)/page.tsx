import { createClient } from "@/lib/supabase/server";
import type { Category, Product } from "@/lib/types";
import { getMovements, getTodayUsage, getWorkerStatusToday, type WorkerStatus } from "@/lib/queries";
import type { Movement } from "@/lib/insights";
import { DashboardClient } from "@/components/dashboard-client";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [cats, prods, movements, todayUsage, workerStatus] = await Promise.all([
    supabase.from("categories").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("products").select("*"),
    getMovements(supabase),
    getTodayUsage(supabase, today),
    getWorkerStatusToday(supabase, today),
  ]);

  return (
    <DashboardClient
      categories={(cats.data ?? []) as Category[]}
      products={(prods.data ?? []) as Product[]}
      movements={movements as Movement[]}
      todayUsage={todayUsage}
      workerStatus={workerStatus as WorkerStatus[]}
      today={today}
    />
  );
}
