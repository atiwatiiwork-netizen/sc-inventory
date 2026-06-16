import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/worker-session";
import { WorkerModuleSwitcher } from "@/components/worker-module-switcher";

/**
 * Guards the authenticated worker area. The /worker/login page lives outside
 * this route group, so it is not affected. Middleware guards too — this is
 * defence-in-depth and gives pages access to the verified session.
 *
 * After PIN login the worker can switch between SC Inventory (daily usage) and
 * SC Wheels (production) via the slim module switcher.
 */
export default async function WorkerSecureLayout({ children }: { children: React.ReactNode }) {
  const session = await getWorkerSession();
  if (!session) redirect("/worker/login");
  return (
    <>
      <WorkerModuleSwitcher />
      {children}
    </>
  );
}
