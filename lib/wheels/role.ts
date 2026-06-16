import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolve the signed-in admin-console user's identity + authority.
 *
 * Office staff and administrators both authenticate through Supabase Auth; the
 * existing `profiles.role` column (default `'admin'`) separates them. Only
 * `'admin'` may override a negative-stock soft-block or record the exceptional
 * raw-wheel sale. Existing accounts default to `'admin'`, so nothing breaks;
 * `'office'` is opt-in (set in the DB).
 */
export async function getAdminActor(): Promise<{ by: string; role: string; isAdmin: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { by: "admin", role: "office", isAdmin: false };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (profile?.role as string) || "admin";
  return { by: user.email ?? "admin", role, isAdmin: role === "admin" };
}
