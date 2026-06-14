"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getWorkerSession } from "@/lib/worker-session";
import { maybeSendDailyAfterSubmit } from "@/lib/line/send";

export type UsageLine = { product_id: string; qty: number };
export type SubmitResult = { ok: boolean; error?: string; time?: string };

/**
 * Commit a worker's daily usage. Verifies the signed worker session, then calls
 * the atomic submit_daily_usage RPC via the service role (workers are not
 * Supabase-auth users). Mirrors each line as an 'out' transaction linked to the
 * submission. Idempotent for the same day → supports editing today's entry.
 */
export async function submitUsage(input: {
  date: string;
  group: string | null;
  noUsage: boolean;
  lines: UsageLine[];
}): Promise<SubmitResult> {
  const session = await getWorkerSession();
  if (!session) return { ok: false, error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };

  if (!input.noUsage && !input.group) return { ok: false, error: "กรุณาเลือกกลุ่มลูกค้า" };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "ยังไม่ได้ตั้งค่า Supabase — ดูไฟล์ README" };
  }

  const lines = input.noUsage ? [] : input.lines.filter((l) => l.product_id && l.qty > 0);

  const supabase = createServiceClient();
  const { error } = await supabase.rpc("submit_daily_usage", {
    p_worker: session.id,
    p_date: input.date,
    p_group: input.noUsage ? null : input.group,
    p_no_usage: input.noUsage,
    p_lines: lines,
  });
  if (error) return { ok: false, error: error.message };

  // If every active worker has now submitted, push the daily LINE summary.
  // Idempotent + failure-isolated, so it never affects this submission.
  await maybeSendDailyAfterSubmit();

  revalidatePath("/worker");
  return { ok: true, time: new Date().toTimeString().slice(0, 5) };
}
