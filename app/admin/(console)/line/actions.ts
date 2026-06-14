"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLineSettings, saveLineSettings } from "@/lib/settings";
import type { LineSettings } from "@/lib/line/settings-types";
import { gatherDaily } from "@/lib/line/data";
import { buildDaily } from "@/lib/line/format";
import { pushText } from "@/lib/line/client";

export type ActionResult = { ok: boolean; error?: string };

export async function saveLine(patch: Partial<LineSettings>): Promise<ActionResult> {
  const supabase = await createClient();
  try {
    await saveLineSettings(supabase, patch);
    revalidatePath("/admin/line");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Send a one-off test of the daily message using the supplied (unsaved) settings. */
export async function sendTest(settings: LineSettings): Promise<ActionResult> {
  if (!settings.token || !settings.recipientId) return { ok: false, error: "กรุณากรอก Channel Access Token และผู้รับก่อนทดสอบ" };
  const supabase = await createClient();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const data = await gatherDaily(supabase, today);
    const text = `🧪 ข้อความทดสอบ\n\n${buildDaily(data, settings)}`;
    const res = await pushText(settings.token, settings.recipientId, text);
    if (!res.ok) return { ok: false, error: res.error };
    await supabase.from("notification_logs").insert({ kind: "test", period_key: new Date().toISOString(), status: "sent", recipient: settings.recipientName });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
