import { createClient } from "@/lib/supabase/server";
import type { Category, Product } from "@/lib/types";
import { InventoryClient } from "@/components/inventory-client";

export default async function InventoryPage() {
  const supabase = await createClient();
  const [cats, prods] = await Promise.all([
    supabase.from("categories").select("*").eq("archived", false).order("display_order"),
    supabase.from("products").select("*").order("display_order"),
  ]);
  return <InventoryClient categories={(cats.data ?? []) as Category[]} products={(prods.data ?? []) as Product[]} />;
}
