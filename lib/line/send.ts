import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { getLineSettings, type LineSettings } from "@/lib/settings";
import { getWorkerStatusToday } from "@/lib/queries";
import { pushText } from "@/lib/line/client";
import { gatherDaily, gatherWeekly, gatherMonthly } from "@/lib/line/data";
import { buildDaily, buildWeekly, buildMonthly, buildLowstockAlert } from "@/lib/line/format";

export type SendResult = { status: "sent" | "skipped" | "failed"; reason?: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const todayISO = () => iso(new Date());

/** Previous full Mon–Sun week, with a Thai range label. */
function prevWeek() {
  const now = new Date();
  const dowMon = (now.getUTCDay() + 6) % 7; // Mon=0
  const thisMon = new Date(now);
  thisMon.setUTCDate(now.getUTCDate() - dowMon);
  const prevMon = new Date(thisMon);
  prevMon.setUTCDate(thisMon.getUTCDate() - 7);
  const prevSun = new Date(thisMon);
  prevSun.setUTCDate(thisMon.getUTCDate() - 1);
  const f = (d: Date) => d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  return { start: iso(prevMon), end: iso(prevSun), key: iso(prevMon), label: `${f(prevMon)} – ${f(prevSun)}` };
}

/** Previous calendar month. */
function prevMonth() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const key = `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start: iso(first), end: iso(last), key, label: first.toLocaleDateString("th-TH", { month: "long", year: "numeric" }) };
}

/**
 * Idempotency claim. Returns true if THIS caller should perform the send.
 * Relies on the unique(kind, period_key) constraint to serialise concurrent
 * callers (after-submit trigger vs. cron fallback).
 */
async function claim(supabase: SupabaseClient, kind: string, periodKey: string, recipient: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from("notification_logs")
    .select("id, status")
    .eq("kind", kind)
    .eq("period_key", periodKey)
    .maybeSingle();

  if (existing?.status === "sent") return false; // already delivered
  if (!existing) {
    const { error } = await supabase.from("notification_logs").insert({ kind, period_key: periodKey, status: "sending", recipient });
    return !error; // unique violation → another caller won the race → skip
  }
  // previous attempt failed or is stale → re-claim for retry
  await supabase.from("notification_logs").update({ status: "sending", recipient, updated_at: new Date().toISOString() }).eq("id", existing.id);
  return true;
}

async function finish(supabase: SupabaseClient, kind: string, periodKey: string, status: string, detail?: string) {
  await supabase.from("notification_logs").update({ status, detail: detail?.slice(0, 500), updated_at: new Date().toISOString() }).eq("kind", kind).eq("period_key", periodKey);
}

function ready(s: LineSettings): SendResult | null {
  if (!s.enabled) return { status: "skipped", reason: "การส่งถูกปิดอยู่" };
  if (!s.token || !s.recipientId) return { status: "skipped", reason: "ยังไม่ได้ตั้งค่า token หรือผู้รับ" };
  return null;
}

export async function sendDaily(): Promise<SendResult> {
  const supabase = createServiceClient();
  const s = await getLineSettings(supabase);
  const notReady = ready(s);
  if (notReady) return notReady;

  const today = todayISO();
  if (!(await claim(supabase, "daily", today, s.recipientName))) return { status: "skipped", reason: "ส่งสรุปวันนี้แล้ว" };

  try {
    const data = await gatherDaily(supabase, today);
    const res = await pushText(s.token, s.recipientId, buildDaily(data, s));
    if (!res.ok) {
      await finish(supabase, "daily", today, "failed", res.error);
      return { status: "failed", reason: res.error };
    }
    await finish(supabase, "daily", today, "sent", `${data.submitted}/${data.total}`);

    // immediate low-stock as a separate message (digest is already inside daily)
    if (s.lowstockMode === "immediate" && data.lowstockCount > 0 && (await claim(supabase, "lowstock", today, s.recipientName))) {
      const lr = await pushText(s.token, s.recipientId, buildLowstockAlert(data, s));
      await finish(supabase, "lowstock", today, lr.ok ? "sent" : "failed", lr.error);
    }
    return { status: "sent" };
  } catch (e) {
    await finish(supabase, "daily", today, "failed", String(e));
    return { status: "failed", reason: String(e) };
  }
}

export async function sendWeekly(): Promise<SendResult> {
  const supabase = createServiceClient();
  const s = await getLineSettings(supabase);
  const notReady = ready(s);
  if (notReady) return notReady;

  const w = prevWeek();
  if (!(await claim(supabase, "weekly", w.key, s.recipientName))) return { status: "skipped", reason: "ส่งสรุปสัปดาห์นี้แล้ว" };
  try {
    const data = await gatherWeekly(supabase, w.start, w.end, w.label);
    const res = await pushText(s.token, s.recipientId, buildWeekly(data, s));
    await finish(supabase, "weekly", w.key, res.ok ? "sent" : "failed", res.error);
    return res.ok ? { status: "sent" } : { status: "failed", reason: res.error };
  } catch (e) {
    await finish(supabase, "weekly", w.key, "failed", String(e));
    return { status: "failed", reason: String(e) };
  }
}

export async function sendMonthly(): Promise<SendResult> {
  const supabase = createServiceClient();
  const s = await getLineSettings(supabase);
  const notReady = ready(s);
  if (notReady) return notReady;

  const m = prevMonth();
  if (!(await claim(supabase, "monthly", m.key, s.recipientName))) return { status: "skipped", reason: "ส่งสรุปเดือนนี้แล้ว" };
  try {
    const data = await gatherMonthly(supabase, m.start, m.end, m.label);
    const res = await pushText(s.token, s.recipientId, buildMonthly(data, s));
    await finish(supabase, "monthly", m.key, res.ok ? "sent" : "failed", res.error);
    return res.ok ? { status: "sent" } : { status: "failed", reason: res.error };
  } catch (e) {
    await finish(supabase, "monthly", m.key, "failed", String(e));
    return { status: "failed", reason: String(e) };
  }
}

/**
 * Called after a worker submits. Sends the daily summary only once ALL active
 * workers have submitted (and trigger mode is "after"). sendDaily() is itself
 * idempotent, so the 19:30 cron fallback never double-sends.
 */
export async function maybeSendDailyAfterSubmit(): Promise<void> {
  try {
    const supabase = createServiceClient();
    const s = await getLineSettings(supabase);
    if (!s.enabled || s.dailyTrigger !== "after") return;
    const ws = await getWorkerStatusToday(supabase, todayISO());
    if (ws.length === 0 || ws.some((w) => w.status !== "submitted")) return; // not everyone in yet
    await sendDaily();
  } catch {
    // never let notification failure affect the worker's submission
  }
}
