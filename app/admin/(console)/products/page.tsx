import { createClient } from "@/lib/supabase/server";
import type { Category, Product } from "@/lib/types";
import { ProductsClient } from "@/components/products-client";

export default async function ProductsPage() {
  const supabase = await createClient();
  const [prods, cats] = await Promise.all([
    supabase.from("products").select("*").order("display_order"),
    supabase.from("categories").select("*").eq("archived", false).order("display_order"),
  ]);

  return <ProductsClient products={(prods.data ?? []) as Product[]} categories={(cats.data ?? []) as Category[]} />;
}
