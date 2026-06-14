import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/worker-session";

/**
 * Guards the authenticated worker area. The /worker/login page lives outside
 * this route group, so it is not affected. Middleware guards too — this is
 * defence-in-depth and gives pages access to the verified session.
 */
export default async function WorkerSecureLayout({ children }: { children: React.ReactNode }) {
  const session = await getWorkerSession();
  if (!session) redirect("/worker/login");
  return <>{children}</>;
}
