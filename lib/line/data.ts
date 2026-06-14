import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type Category, type Product, stockStatus } from "@/lib/types";
import { inUnit } from "@/lib/insights";
import { getReportRows, getTodayUsage, getWorkerStatusToday } from "@/lib/queries";
import type { DailyData, WeeklyData, MonthlyData, LowItem } from "@/lib/line/format";

const thDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

async function baseCatsProds(supabase: SupabaseClient) {
  const [{ data: cats }, { data: prods }] = await Promise.all([
    supabase.from("categories").select("*").eq("active", true).eq("archived", false).order("display_order"),
    supabase.from("products").select("*"),
  ]);
  return { cats: (cats ?? []) as Category[], prods: (prods ?? []) as Product[] };
}

function lowstockOf(prods: Product[]): { items: LowItem[]; count: number } {
  const low = prods
    .filter((p) => stockStatus(p) !== "green")
    .sort((a, b) => a.stock / Math.max(a.min_stock, 1) - b.stock / Math.max(b.min_stock, 1));
  return { items: low.map((p) => ({ name: p.name, stock: p.stock, min: p.min_stock })), count: low.length };
}

async function topGroupName(supabase: SupabaseClient, totals: Record<string, number>): Promise<string | null> {
  const entries = Object.entries(totals);
  if (!entries.length) return null;
  const [topId] = entries.sort((a, b) => b[1] - a[1])[0];
  const { data } = await supabase.from("customer_groups").select("name").eq("id", topId).maybeSingle();
  return (data?.name as string) ?? null;
}

function catValues(cats: Category[], prods: Product[], usage: Record<string, number>) {
  return cats.map((c) => {
    let pieces = 0;
    let meters = 0;
    const bySize: Record<string, number> = {};
    for (const p of prods) {
      if (p.category_id !== c.id) continue;
      const q = usage[p.id] || 0;
      if (!q) continue;
      pieces += q;
      if (p.length_m) {
        meters += p.length_m * q;
        if (p.size) bySize[p.size] = (bySize[p.size] || 0) + p.length_m * q;
      }
    }
    const value = c.report_unit === "m" ? meters : pieces;
    return {
      name: c.name,
      unitTh: c.report_unit_th ?? "",
      value,
      secondaryValue: c.report_unit === "m" ? pieces : undefined,
      secondaryUnitTh: c.report_unit === "m" ? c.secondary_unit_th ?? undefined : undefined,
      sizeMeters:
        c.report_unit === "m"
          ? Object.entries(bySize).map(([size, m]) => ({ size, meters: m })).sort((a, b) => a.size.localeCompare(b.size))
          : undefined,
    };
  });
}

export async function gatherDaily(supabase: SupabaseClient, today: string): Promise<DailyData> {
  const { cats, prods } = await baseCatsProds(supabase);
  const [todayUsage, ws] = await Promise.all([getTodayUsage(supabase, today), getWorkerStatusToday(supabase, today)]);
  const categories = catValues(cats, prods, todayUsage);
  const low = lowstockOf(prods);
  const submittedList = ws.filter((w) => w.status === "submitted");
  const last = submittedList[submittedList.length - 1];
  return {
    dateLabel: thDate(today),
    time: last?.time ?? null,
    categories,
    lowstock: low.items,
    lowstockCount: low.count,
    submitted: submittedList.length,
    total: ws.length,
    lastWorker: last?.name ?? null,
    lastTime: last?.time ?? null,
  };
}

export async function gatherWeekly(supabase: SupabaseClient, start: string, end: string, label: string): Promise<WeeklyData> {
  const { cats, prods } = await baseCatsProds(supabase);
  const rows = (await getReportRows(supabase, 14)).filter((r) => r.date >= start && r.date <= end);
  const categories = cats
    .map((c) => ({
      name: c.name,
      unitTh: c.report_unit_th ?? "",
      value: rows.filter((r) => r.categoryId === c.id).reduce((s, r) => s + inUnit(c.report_unit, r.qty, r.lengthM), 0),
    }))
    .filter((c) => c.value > 0);
  const totals: Record<string, number> = {};
  rows.forEach((r) => {
    if (r.group) totals[r.group] = (totals[r.group] || 0) + r.qty;
  });
  return { rangeLabel: label, categories, lowstockCount: lowstockOf(prods).count, topGroup: await topGroupName(supabase, totals) };
}

export async function gatherMonthly(supabase: SupabaseClient, start: string, end: string, label: string): Promise<MonthlyData> {
  const { cats, prods } = await baseCatsProds(supabase);
  const rows = (await getReportRows(supabase, 40)).filter((r) => r.date >= start && r.date <= end);
  const categories = cats
    .map((c) => ({
      name: c.name,
      unitTh: c.report_unit_th ?? "",
      value: rows.filter((r) => r.categoryId === c.id).reduce((s, r) => s + inUnit(c.report_unit, r.qty, r.lengthM), 0),
    }))
    .filter((c) => c.value > 0);

  const prodBySku = new Map(prods.map((p) => [p.sku, p]));
  const skuAgg: Record<string, number> = {};
  rows.forEach((r) => {
    skuAgg[r.sku] = (skuAgg[r.sku] || 0) + r.qty;
  });
  const topSkus = Object.entries(skuAgg)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([sku, qty]) => ({ label: sku, name: prodBySku.get(sku)?.name ?? sku, value: qty, unitTh: prodBySku.get(sku)?.unit ?? "" }));

  const totals: Record<string, number> = {};
  rows.forEach((r) => {
    if (r.group) totals[r.group] = (totals[r.group] || 0) + r.qty;
  });
  return { monthLabel: label, categories, topSkus, topGroup: await topGroupName(supabase, totals) };
}
