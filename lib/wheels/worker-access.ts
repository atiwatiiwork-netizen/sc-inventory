import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { WHEELS_WORKER_FUNCTIONS } from "@/lib/wheels/worker-functions";

/**
 * Resolve which SC Wheels worker functions a worker may use (function
 * availability, not ERP permissions). Default-open: a function with no role
 * mapping is allowed for everyone; otherwise the worker's single role must be
 * among the mapped roles. Resolved per request (role is read live, not from the
 * session), so role changes take effect without re-login.
 */
export async function getWheelsAccess(workerId: string): Promise<Record<string, boolean>> {
  const supabase = createServiceClient();
  const [{ data: w }, { data: maps }] = await Promise.all([
    supabase.from("workers").select("role_id").eq("id", workerId).maybeSingle(),
    supabase.from("wheels_function_roles").select("function_key, role_id"),
  ]);

  const roleId = (w?.role_id as string | null) ?? null;
  const rolesByFn = new Map<string, Set<string>>();
  for (const m of (maps ?? []) as { function_key: string; role_id: string }[]) {
    const set = rolesByFn.get(m.function_key) ?? new Set<string>();
    set.add(m.role_id);
    rolesByFn.set(m.function_key, set);
  }

  const out: Record<string, boolean> = {};
  for (const f of WHEELS_WORKER_FUNCTIONS) {
    const roles = rolesByFn.get(f.key);
    const hasMapping = !!roles && roles.size > 0;
    const mappedToMe = hasMapping && roleId !== null && roles!.has(roleId);
    // Default-closed functions require an explicit role mapping; default-open
    // functions are allowed when unmapped (the original model behaviour).
    out[f.key] = f.defaultClosed ? mappedToMe : !hasMapping || mappedToMe;
  }
  return out;
}

/** Convenience guard for a single function (defaults open if unknown). */
export async function canUseWheelsFunction(workerId: string, key: string): Promise<boolean> {
  const access = await getWheelsAccess(workerId);
  return access[key] ?? true;
}
