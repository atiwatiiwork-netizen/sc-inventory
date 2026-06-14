// Pure LINE message builders — used by BOTH the live preview (client) and the
// real send path (server). Edit message wording/structure here in ONE place.
//
// Rules locked in Phase 4:
//  • Text-only, mobile-readable, category totals each in their own unit.
//  • Daily usage = category-level ONLY (never SKUs).
//  • SKUs allowed only in low-stock lines and the monthly top-SKU list.
//  • Optional custom headerText / footerText wrap every message.

import type { LineSettings } from "@/lib/line/settings-types";

const nf = (n: number) => n.toLocaleString("en-US");

export type CatLine = {
  name: string;
  unitTh: string;
  value: number;
  secondaryValue?: number;
  secondaryUnitTh?: string;
  /** rails only — meters by size, shown at "detailed" level */
  sizeMeters?: { size: string; meters: number }[];
};
export type LowItem = { name: string; stock: number; min: number };

export type DailyData = {
  dateLabel: string;
  time: string | null;
  categories: CatLine[];
  lowstock: LowItem[];
  lowstockCount: number;
  submitted: number;
  total: number;
  lastWorker: string | null;
  lastTime: string | null;
};

export type WeeklyData = {
  rangeLabel: string;
  categories: { name: string; unitTh: string; value: number }[];
  lowstockCount: number;
  topGroup: string | null;
};

export type MonthlyData = {
  monthLabel: string;
  categories: { name: string; unitTh: string; value: number }[];
  topSkus: { label: string; name: string; value: number; unitTh: string }[];
  topGroup: string | null;
};

function wrap(lines: string[], s: LineSettings): string {
  const out: string[] = [];
  if (s.headerText.trim()) {
    out.push(s.headerText.trim(), "");
  }
  out.push(...lines);
  if (s.footerText.trim()) {
    out.push("", s.footerText.trim());
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Low-stock section lines (shared by daily digest + standalone alert). */
function lowstockLines(d: { lowstock: LowItem[]; lowstockCount: number }, s: LineSettings): string[] {
  const lines = [`⚠️ สต็อกต่ำกว่าขั้นต่ำ: ${d.lowstockCount} รายการ`];
  const shown = d.lowstock.slice(0, Math.max(0, s.lowstockMax));
  for (const it of shown) lines.push(`• ${it.name}: เหลือ ${nf(it.stock)} (ขั้นต่ำ ${nf(it.min)})`);
  if (d.lowstockCount > shown.length) {
    lines.push(`   + อีก ${d.lowstockCount - shown.length} รายการ — ดูในเว็บแอป →`);
  }
  return lines;
}

export function buildDaily(d: DailyData, s: LineSettings): string {
  const L: string[] = [];
  L.push("📋 สรุปการใช้ประจำวัน");
  L.push(d.dateLabel + (d.time ? ` · ${d.time} น.` : ""));
  L.push("");

  if (s.detail !== "minimal") {
    L.push("การใช้ตามหมวดหมู่");
    for (const c of d.categories) {
      let line = `• ${c.name}: ${nf(c.value)} ${c.unitTh}`;
      if (c.secondaryValue != null && c.secondaryUnitTh) line += ` (${nf(c.secondaryValue)} ${c.secondaryUnitTh})`;
      L.push(line);
      if (s.detail === "detailed" && c.sizeMeters?.length) {
        for (const sm of c.sizeMeters) L.push(`   – ${sm.size}: ${nf(sm.meters)} ม.`);
      }
    }
    L.push("");
  }

  // low stock — only when digest mode (immediate goes as its own message)
  if (s.lowstockMode === "digest") {
    L.push(...lowstockLines(d, s));
    L.push("");
  }

  L.push(
    `ส่งข้อมูลแล้ว ${d.submitted}/${d.total} คน` +
      (d.lastWorker ? ` · ล่าสุด ${d.lastWorker} ${d.lastTime ?? ""} น.` : ""),
  );
  return wrap(L, s);
}

export function buildLowstockAlert(d: { dateLabel: string; time: string | null; lowstock: LowItem[]; lowstockCount: number }, s: LineSettings): string {
  const L: string[] = [];
  L.push(`⚠️ แจ้งเตือนสต็อกต่ำ · ${d.dateLabel}${d.time ? ` ${d.time} น.` : ""}`);
  L.push(...lowstockLines(d, s).slice(1)); // drop the duplicate header line
  L.push(`ต่ำกว่าขั้นต่ำรวม ${d.lowstockCount} รายการ`);
  L.push("จัดการเติมสต็อกในเว็บแอป →");
  return wrap(L, s);
}

export function buildWeekly(d: WeeklyData, s: LineSettings): string {
  const L: string[] = [];
  L.push("📊 สรุปรายสัปดาห์");
  L.push(d.rangeLabel);
  L.push("");
  L.push("การใช้รวมตามหมวดหมู่");
  for (const c of d.categories) L.push(`• ${c.name}: ${nf(c.value)} ${c.unitTh}`);
  L.push("");
  if (d.topGroup) L.push(`กลุ่มลูกค้าหลัก: ${d.topGroup}`);
  L.push(`⚠️ สต็อกต่ำกว่าขั้นต่ำ: ${d.lowstockCount} รายการ`);
  L.push("ดูรายงานเต็มในเว็บแอป →");
  return wrap(L, s);
}

export function buildMonthly(d: MonthlyData, s: LineSettings): string {
  const L: string[] = [];
  L.push("🗓️ สรุปรายเดือน");
  L.push(d.monthLabel);
  L.push("");
  L.push("การใช้รวมตามหมวดหมู่");
  for (const c of d.categories) L.push(`• ${c.name}: ${nf(c.value)} ${c.unitTh}`);
  if (d.topSkus.length) {
    L.push("");
    L.push("SKU ที่ใช้มากที่สุด");
    d.topSkus.forEach((t, i) => L.push(`${i + 1}. ${t.name} — ${nf(t.value)} ${t.unitTh}`));
  }
  L.push("");
  if (d.topGroup) L.push(`กลุ่มลูกค้าหลัก: ${d.topGroup}`);
  L.push("ดูรายงานเต็มในเว็บแอป →");
  return wrap(L, s);
}
