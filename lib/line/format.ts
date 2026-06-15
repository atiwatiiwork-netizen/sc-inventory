// ============================================================================
//  Centralised LINE message formatting — the ONE place to edit how LINE
//  messages look. Pure (no DB / no server-only), used by both the live preview
//  (client) and the real send path (server). Does NOT compute business data;
//  it only formats values it is given.
//
//  Design rules (mobile-first):
//   • Text-only, short lines, shallow indentation.
//   • One product per line block: name on its own line, "qty unit" on the next.
//   • Quantity and unit always together; never say "รายการ" for a measured qty.
//   • Section dividers between blocks; never mix units across categories.
// ============================================================================

import type { LineSettings } from "@/lib/line/settings-types";

/* ── primitive helpers ───────────────────────────────────────────────────── */

const nf = (n: number) => Math.round(n).toLocaleString("en-US");

/** Thai date with Buddhist-era year, e.g. "15 มิ.ย. 2569". Accepts ISO or label. */
export function formatDateThai(input?: string): string {
  if (input && !/^\d{4}-\d{2}-\d{2}/.test(input)) return input; // already a label
  const d = input ? new Date(input) : new Date();
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

/** "120 เส้น" — number with thousands separator + unit on the same line. */
export function formatQuantity(value: number, unit?: string | null): string {
  return unit ? `${nf(value)} ${unit}` : nf(value);
}

/** Trim very long product names so a single line never blows up. */
export function truncateProductName(name: string, max = 40): string {
  const n = name.trim();
  return n.length > max ? n.slice(0, max - 1).trimEnd() + "…" : n;
}

/** Soft-wrap free text to a mobile-friendly width at word boundaries. */
export function wrapLineForLineApp(text: string, width = 34): string {
  return text
    .split("\n")
    .map((line) => {
      if (line.length <= width) return line;
      const words = line.split(" ");
      const out: string[] = [];
      let cur = "";
      for (const w of words) {
        if (cur && (cur + " " + w).length > width) {
          out.push(cur);
          cur = w;
        } else {
          cur = cur ? cur + " " + w : w;
        }
      }
      if (cur) out.push(cur);
      return out.join("\n");
    })
    .join("\n");
}

/** A light section divider. */
export function buildDivider(): string {
  return "────────────────────";
}

/** One product as two lines: "• name" then indented "qty unit". */
export function formatProductLine(name: string, qty: number, unit?: string | null): string[] {
  return [`• ${truncateProductName(name)}`, `  ${formatQuantity(qty, unit)}`];
}

/** A low-stock item as two lines: "• name" then indented stock/min. */
export function formatLowStockLine(name: string, stock: number, min: number, unit?: string | null): string[] {
  return [`• ${truncateProductName(name)}`, `  เหลือ ${formatQuantity(stock, unit)} (ขั้นต่ำ ${nf(min)})`];
}

/** Category title block: emoji + name, date, optional recorder. */
export function formatCategoryHeader(emoji: string, name: string, date?: string, recorder?: string): string[] {
  const lines = [`${emoji} ${name}`, formatDateThai(date)];
  if (recorder) lines.push(`ผู้บันทึก: ${recorder}`);
  return lines;
}

type Item = { name: string; qty: number; unit: string };

function uniformUnit(items: Item[]): string | null {
  const us = new Set(items.map((i) => i.unit).filter(Boolean));
  return us.size === 1 ? [...us][0] : null;
}

/** A customer-group block: name, "รวม: …" (only if one unit), then product lines. */
export function formatCustomerGroupSection(groupName: string, items: Item[]): string[] {
  const lines: string[] = [groupName];
  const uni = uniformUnit(items);
  const sum = items.reduce((a, b) => a + b.qty, 0);
  if (uni) lines.push(`รวม: ${formatQuantity(sum, uni)}`);
  for (const it of items) {
    lines.push("");
    lines.push(...formatProductLine(it.name, it.qty, it.unit));
  }
  return lines;
}

/** Footer with one or more totals (each its own unit) + the web link. */
export function formatSummaryFooter(totals: { value: number; unit: string }[], label = "รวมหมวดนี้:"): string[] {
  const lines = [label, ...totals.map((t) => formatQuantity(t.value, t.unit)), "", "ดูรายละเอียดในเว็บแอป →"];
  return lines;
}

/* ── block assembly ──────────────────────────────────────────────────────── */

/** Join blocks with a blank line between them, except after a divider (no blank after). */
function assemble(blocks: string[][], s: LineSettings): string {
  const div = buildDivider();
  const parts = blocks.filter((b) => b.length > 0).map((b) => b.join("\n"));
  let body = "";
  for (let i = 0; i < parts.length; i++) {
    if (i === 0) { body = parts[i]; continue; }
    body += parts[i - 1] === div ? "\n" : "\n\n";
    body += parts[i];
  }
  const out: string[] = [];
  if (s.headerText.trim()) out.push(wrapLineForLineApp(s.headerText.trim()), "");
  out.push(body);
  if (s.footerText.trim()) out.push("", wrapLineForLineApp(s.footerText.trim()));
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* ── shared data types (unchanged calculations; display only) ─────────────── */

export type CatLine = {
  name: string;
  unitTh: string;
  value: number;
  secondaryValue?: number;
  secondaryUnitTh?: string;
  sizeMeters?: { size: string; meters: number }[];
};
export type LowItem = { name: string; stock: number; min: number; unit?: string | null };

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

export type WorkerCatData = {
  dateLabel: string;
  worker: string;
  categoryName: string;
  isRail: boolean;
  groups: { name: string; items: { name: string; qty: number; unit: string; lengthM?: number | null }[] }[];
};

/* ── low-stock block (shared by daily digest + standalone alert) ─────────── */

function lowstockBlock(d: { lowstock: LowItem[]; lowstockCount: number }, s: LineSettings): string[] {
  const lines = [`⚠️ สต็อกต่ำกว่าขั้นต่ำ: ${d.lowstockCount} รายการ`];
  const shown = d.lowstock.slice(0, Math.max(0, s.lowstockMax));
  for (const it of shown) lines.push(...formatLowStockLine(it.name, it.stock, it.min, it.unit));
  if (d.lowstockCount > shown.length) lines.push(`+ อีก ${d.lowstockCount - shown.length} รายการ — ดูในเว็บแอป →`);
  return lines;
}

/* ── message builders ────────────────────────────────────────────────────── */

export function buildDaily(d: DailyData, s: LineSettings): string {
  const blocks: string[][] = [];
  blocks.push(["📋 สรุปการใช้ประจำวัน", formatDateThai(d.dateLabel) + (d.time ? ` · ${d.time} น.` : "")]);

  if (s.detail !== "minimal") {
    const cat: string[] = ["การใช้ตามหมวดหมู่"];
    for (const c of d.categories) {
      cat.push("");
      cat.push(`• ${c.name}`);
      let qty = formatQuantity(c.value, c.unitTh);
      if (c.secondaryValue != null && c.secondaryUnitTh) qty += ` (${formatQuantity(c.secondaryValue, c.secondaryUnitTh)})`;
      cat.push(`  ${qty}`);
      if (s.detail === "detailed" && c.sizeMeters?.length) {
        for (const sm of c.sizeMeters) cat.push(`  – ${sm.size}: ${formatQuantity(sm.meters, "เมตร")}`);
      }
    }
    blocks.push([buildDivider()]);
    blocks.push(cat);
  }

  if (s.lowstockMode === "digest") {
    blocks.push([buildDivider()]);
    blocks.push(lowstockBlock(d, s));
  }

  blocks.push([buildDivider()]);
  const status = [`ส่งข้อมูลแล้ว ${d.submitted}/${d.total} คน`];
  if (d.lastWorker) status.push(`ล่าสุด ${d.lastWorker} ${d.lastTime ?? ""} น.`);
  blocks.push(status);

  return assemble(blocks, s);
}

export function buildLowstockAlert(
  d: { dateLabel: string; time: string | null; lowstock: LowItem[]; lowstockCount: number },
  s: LineSettings,
): string {
  const blocks: string[][] = [];
  blocks.push(["⚠️ แจ้งเตือนสต็อกต่ำ", formatDateThai(d.dateLabel) + (d.time ? ` · ${d.time} น.` : "")]);
  blocks.push([buildDivider()]);
  blocks.push(lowstockBlock(d, s).slice(1)); // drop the heading line; this whole message is the alert
  blocks.push([buildDivider()]);
  blocks.push([`รวมต่ำกว่าขั้นต่ำ: ${d.lowstockCount} รายการ`, "จัดการเติมสต็อกในเว็บแอป →"]);
  return assemble(blocks, s);
}

/** Manual, per-category low-stock alert — one message per selected category. */
export function buildLowstockByCategory(categoryName: string, items: LowItem[], s: LineSettings): string {
  const blocks: string[][] = [];
  blocks.push(["⚠️ แจ้งเตือนสต็อกต่ำ", `หมวด: ${categoryName}`, formatDateThai()]);
  blocks.push([buildDivider()]);
  const lines: string[] = [];
  for (const it of items) lines.push(...formatLowStockLine(it.name, it.stock, it.min, it.unit));
  blocks.push(lines);
  blocks.push([buildDivider()]);
  blocks.push([`รวมต่ำกว่าขั้นต่ำ: ${items.length} รายการ`, "จัดการเติมสต็อกในเว็บแอป →"]);
  return assemble(blocks, s);
}

export function buildWeekly(d: WeeklyData, s: LineSettings): string {
  const blocks: string[][] = [];
  blocks.push(["📊 สรุปรายสัปดาห์", d.rangeLabel]);
  blocks.push([buildDivider()]);
  const cat: string[] = ["การใช้รวมตามหมวดหมู่"];
  for (const c of d.categories) {
    cat.push("");
    cat.push(`• ${c.name}`);
    cat.push(`  ${formatQuantity(c.value, c.unitTh)}`);
  }
  blocks.push(cat);
  blocks.push([buildDivider()]);
  const tail: string[] = [];
  if (d.topGroup) tail.push(`กลุ่มลูกค้าหลัก: ${d.topGroup}`);
  tail.push(`สต็อกต่ำกว่าขั้นต่ำ: ${d.lowstockCount} รายการ`);
  tail.push("ดูรายงานเต็มในเว็บแอป →");
  blocks.push(tail);
  return assemble(blocks, s);
}

export function buildMonthly(d: MonthlyData, s: LineSettings): string {
  const blocks: string[][] = [];
  blocks.push(["🗓️ สรุปรายเดือน", d.monthLabel]);
  blocks.push([buildDivider()]);
  const cat: string[] = ["การใช้รวมตามหมวดหมู่"];
  for (const c of d.categories) {
    cat.push("");
    cat.push(`• ${c.name}`);
    cat.push(`  ${formatQuantity(c.value, c.unitTh)}`);
  }
  blocks.push(cat);
  if (d.topSkus.length) {
    blocks.push([buildDivider()]);
    const top: string[] = ["SKU ที่ใช้มากที่สุด"];
    d.topSkus.forEach((t, i) => {
      top.push("");
      top.push(`${i + 1}. ${truncateProductName(t.name)}`);
      top.push(`  ${formatQuantity(t.value, t.unitTh)}`);
    });
    blocks.push(top);
  }
  blocks.push([buildDivider()]);
  const tail: string[] = [];
  if (d.topGroup) tail.push(`กลุ่มลูกค้าหลัก: ${d.topGroup}`);
  tail.push("ดูรายงานเต็มในเว็บแอป →");
  blocks.push(tail);
  return assemble(blocks, s);
}

/** Worker-initiated per-category push: only this category, only non-zero SKUs. */
export function buildWorkerCategory(d: WorkerCatData, s: LineSettings): string {
  const blocks: string[][] = [];
  blocks.push(formatCategoryHeader("📦", d.categoryName, d.dateLabel, d.worker));

  const allItems = d.groups.flatMap((g) => g.items);
  for (const g of d.groups) {
    if (g.items.length === 0) continue;
    blocks.push(formatCustomerGroupSection(g.name, g.items));
  }

  blocks.push([buildDivider()]);
  const totals: { value: number; unit: string }[] = [];
  const uni = uniformUnit(allItems);
  const sum = allItems.reduce((a, b) => a + b.qty, 0);
  if (uni) totals.push({ value: sum, unit: uni });
  else totals.push({ value: sum, unit: "รายการ" });
  if (d.isRail) {
    const meters = allItems.reduce((a, b) => a + (b.lengthM ?? 0) * b.qty, 0);
    if (meters > 0) totals.push({ value: meters, unit: "เมตร" });
  }
  blocks.push(formatSummaryFooter(totals));

  return assemble(blocks, s);
}
