"use server";

import { createClient } from "@/lib/supabase/server";
import { getLineSettings } from "@/lib/settings";
import { type Category, type Product, stockStatus } from "@/lib/types";
import { pushText } from "@/lib/line/client";
import { buildLowstockByCategory } from "@/lib/line/format";

export type LowStockSendResult = { ok: boolean; error?: string; sent?: number };

/** Send one LINE alert per selected category, each listing only that
 *  category's low-stock items. Returns how many messages were delivered. */
export async function sendLowStockAlerts(categoryIds: string[]): Promise<LowStockSendResult> {
  if (!categoryIds.length) return { ok: false, error: "กรุณาเลือกอย่างน้อย 1 หมวดหมู่" };

  const supabase = await createClient();
  const s = await getLineSettings(supabase);
  if (!s.enabled) return { ok: false, error: "การส่ง LINE ถูกปิดอยู่ — เปิดใช้งานที่หน้าตั้งค่า LINE ก่อน" };
  if (!s.token || !s.recipientId) return { ok: false, error: "ยังไม่ได้ตั้งค่า Token หรือผู้รับ — ตั้งค่าที่หน้าตั้งค่า LINE" };

  const [{ data: cats }, { data: prods }] = await Promise.all([
    supabase.from("categories").select("*"),
    supabase.from("products").select("*").eq("active", true),
  ]);
  const catList = (cats ?? []) as Category[];
  const prodList = (prods ?? []) as Product[];

  let sent = 0;
  for (const cid of categoryIds) {
    const cat = catList.find((c) => c.id === cid);
    if (!cat) continue;
    const low = prodList
      .filter((p) => p.category_id === cid && stockStatus(p) !== "green")
      .sort((a, b) => a.stock / Math.max(a.min_stock, 1) - b.stock / Math.max(b.min_stock, 1))
      .map((p) => ({ name: p.name, stock: p.stock, min: p.min_stock, unit: p.unit }));
    if (!low.length) continue;

    const res = await pushText(s.token, s.recipientId, buildLowstockByCategory(cat.name, low, s));
    if (!res.ok) return { ok: false, error: `${cat.name}: ${res.error}`, sent };
    sent++;
  }

  if (sent === 0) return { ok: false, error: "ไม่มีรายการสต็อกต่ำในหมวดที่เลือก" };

  await supabase.from("notification_logs").insert({
    kind: "lowstock-manual",
    period_key: new Date().toISOString(),
    status: "sent",
    recipient: s.recipientName,
    detail: `${sent} หมวด`,
  });

  return { ok: true, sent };
}
