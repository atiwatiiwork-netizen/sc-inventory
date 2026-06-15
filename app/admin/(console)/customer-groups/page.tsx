import { createClient } from "@/lib/supabase/server";
import type { CustomerGroup } from "@/lib/types";
import { GroupsClient } from "@/components/groups-client";

export default async function CustomerGroupsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("customer_groups").select("*").order("name");
  return <GroupsClient groups={(data ?? []) as CustomerGroup[]} />;
}
