"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getWorkerSession } from "@/lib/worker-session";
import { maybeSendDailyAfterSubmit } from "@/lib/line/send";
import { getLineSettings } from "@/lib/settings";
import { pushText } from "@/lib/line/client";
import { buildWorkerCategory, formatDateThai, type WorkerCatData } from "@/lib/line/format";

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
  categoryId: string | null;
  lines: UsageLine[];
}): Promise<SubmitResult> {
  const session = await getWorkerSession();
  if (!session) return { ok: false, error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };

  if (!input.noUsage && !input.group) return { ok: false, error: "กรุณาเลือกกลุ่มลูกค้า" };
  if (!input.noUsage && !input.categoryId) return { ok: false, error: "กรุณาเลือกหมวดหมู่" };

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
    p_category: input.noUsage ? null : input.categoryId,
    p_lines: lines,
  });
  if (error) return { ok: false, error: error.message };

  // If every active worker has now submitted, push the daily LINE summary.
  // Idempotent + failure-isolated, so it never affects this submission.
  await maybeSendDailyAfterSubmit();

  revalidatePath("/worker");
  return { ok: true, time: new Date().toTimeString().slice(0, 5) };
}

type SubLine = {
  customer_group_id: string | null;
  submission_items:
    | { qty: number; products: { name: string; category_id: string | null; unit: string | null; length_m: number | null } | null }[]
    | null;
};

/**
 * Worker pushes ONE category's usage to the management LINE group. Includes only
 * non-zero SKUs, grouped by customer group. Requires the category to be complete
 * (recorded for every active customer group) and LINE to be configured.
 */
export async function sendCategoryLine(input: { date: string; categoryId: string }): Promise<SubmitResult> {
  const session = await getWorkerSession();
  if (!session) return { ok: false, error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "ยังไม่ได้ตั้งค่า Supabase" };

  const supabase = createServiceClient();
  const settings = await getLineSettings(supabase);
  if (!settings.enabled || !settings.token || !settings.recipientId) {
    return { ok: false, error: "ยังไม่ได้ตั้งค่า/เปิดใช้งาน LINE (ตั้งค่าที่ฝั่งผู้ดูแล)" };
  }

  // completeness: recorded for every active customer group
  const [{ data: groups }, { count: marks }] = await Promise.all([
    supabase.from("customer_groups").select("id, name").eq("active", true),
    supabase
      .from("submission_category_marks")
      .select("*", { count: "exact", head: true })
      .eq("worker_id", session.id)
      .eq("usage_date", input.date)
      .eq("category_id", input.categoryId),
  ]);
  const groupList = (groups ?? []) as { id: string; name: string }[];
  if ((marks ?? 0) < groupList.length) {
    return { ok: false, error: "ยังกรอกไม่ครบทุกกลุ่มลูกค้า" };
  }

  const [{ data: cat }, { data: subs }] = await Promise.all([
    supabase.from("categories").select("name, report_unit, viz").eq("id", input.categoryId).maybeSingle(),
    supabase
      .from("daily_submissions")
      .select("customer_group_id, submission_items(qty, products(name, category_id, unit, length_m))")
      .eq("worker_id", session.id)
      .eq("usage_date", input.date)
      .eq("no_usage", false),
  ]);

  const groupName = new Map(groupList.map((g) => [g.id, g.name]));
  const dataGroups: WorkerCatData["groups"] = [];
  for (const s of (subs ?? []) as unknown as SubLine[]) {
    const items = (s.submission_items ?? [])
      .filter((it) => it.products?.category_id === input.categoryId && it.qty > 0)
      .map((it) => ({ name: it.products!.name, qty: it.qty, unit: it.products!.unit ?? "", lengthM: it.products!.length_m }));
    if (items.length === 0) continue;
    dataGroups.push({ name: groupName.get(s.customer_group_id ?? "") ?? "—", items });
  }

  const isRail = cat?.viz === "rail" || cat?.report_unit === "m";
  const text = buildWorkerCategory(
    {
      dateLabel: formatDateThai(input.date),
      worker: `${session.name} (${session.code})`,
      categoryName: cat?.name ?? input.categoryId,
      isRail,
      groups: dataGroups,
    },
    settings,
  );

  const res = await pushText(settings.token, settings.recipientId, text);
  if (!res.ok) return { ok: false, error: res.error };

  await supabase
    .from("category_line_sends")
    .upsert(
      { worker_id: session.id, usage_date: input.date, category_id: input.categoryId, sent_at: new Date().toISOString() },
      { onConflict: "worker_id,usage_date,category_id" },
    );
  revalidatePath("/worker");
  return { ok: true, time: new Date().toTimeString().slice(0, 5) };
}
