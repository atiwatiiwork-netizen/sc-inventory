import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";

/**
 * Authenticated admin console. The /admin/login page lives outside this route
 * group so it renders without the shell. Middleware guards too.
 */
export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase.from("profiles").select("name, role").eq("id", user.id).maybeSingle();
  const name = profile?.name || user.email || "ผู้ดูแล";
  const isAdmin = (profile?.role ?? "admin") === "admin";

  return (
    <AdminShell profileName={name} isAdmin={isAdmin}>
      {children}
    </AdminShell>
  );
}
