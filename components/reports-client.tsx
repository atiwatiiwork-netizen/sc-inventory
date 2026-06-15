"use client";

import { useMemo, useState } from "react";
import { type Category, type CustomerGroup, type Product, stockStatus } from "@/lib/types";
import type { ReportRow } from "@/lib/queries";
import { inUnit } from "@/lib/insights";
import { railBucket, railGroups, railKey } from "@/lib/grouping";
import { CAT_COLOR, CAT_ICON, GROUP_COLOR, SIZE_COLOR } from "@/lib/nav";
import { Icon } from "@/components/icon";
import { Btn, Empty, Panel, ScreenHead, Stat, DataTable } from "@/components/ui";
import { Donut, MiniBars, SegBars } from "@/components/charts";

type Tab = "daily" | "weekly" | "monthly";
const TABS: { id: Tab; th: string; en: string }[] = [
  { id: "daily", th: "รายวัน", en: "Daily" },
  { id: "weekly", th: "รายสัปดาห์", en: "Weekly" },
  { id: "monthly", th: "รายเดือน", en: "Monthly" },
];

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function ReportsClient({
  categories,
  customerGroups,
  products,
  rows,
  today,
}: {
  categories: Category[];
  customerGroups: CustomerGroup[];
  products: Product[];
  rows: ReportRow[];
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("daily");
  const [catId, setCatId] = useState(categories[0]?.id ?? "");
  const cat = categories.find((c) => c.id === catId);
  const color = CAT_COLOR[catId] || "var(--accent)";

  const unitVal = useMemo(() => (r: ReportRow) => inUnit(cat?.report_unit, r.qty, r.lengthM), [cat]);
  const catRows = useMemo(() => rows.filter((r) => r.categoryId === catId), [rows, catId]);

  if (!cat) return <Empty msg="ยังไม่มีหมวดหมู่" />;

  const lowCount = products.filter((p) => p.category_id === catId && stockStatus(p) !== "green");

  // Rail buckets for this category (variant → size), ordered — the single
  // grouping shared with the inventory board and stock entry. A row's bucket is
  // resolved via railKey(variant, size), so models like GI form their own bar.
  const railBuckets = (() => {
    if (cat.viz !== "rail") return [] as { key: string; label: string; size: string | null; order: number }[];
    const m = new Map<string, { key: string; label: string; size: string | null; order: number }>();
    products
      .filter((p) => p.category_id === catId && (p.size || p.variant || p.length_m != null))
      .forEach((p) => {
        const b = railBucket(p.variant, p.size);
        const e = m.get(b.key);
        if (!e) m.set(b.key, { key: b.key, label: b.label, size: p.size ?? null, order: p.display_order });
        else if (p.display_order < e.order) e.order = p.display_order;
      });
    return [...m.values()].sort((a, b) => a.order - b.order);
  })();
  const bucketBars = (rs: ReportRow[], val: (r: ReportRow) => number) => {
    const sum: Record<string, number> = {};
    rs.forEach((r) => {
      const k = railKey(r.variant, r.size);
      sum[k] = (sum[k] || 0) + val(r);
    });
    return railBuckets.map((b) => ({ label: b.label, value: sum[b.key] || 0, color: SIZE_COLOR[b.size ?? ""] || color }));
  };

  // --- daily ---
  const dailyRows = catRows.filter((r) => r.date === today);
  const dailyHeadline = dailyRows.reduce((s, r) => s + unitVal(r), 0);
  const dailyPieces = dailyRows.reduce((s, r) => s + r.qty, 0);
  const dailyBySize = bucketBars(dailyRows, (r) => r.qty);
  const dailyByProduct = aggBy(dailyRows, (r) => r.name, unitVal).map((d) => ({ ...d, color }));
  const segDaily = customerGroups.map((g) => ({ label: g.name, value: catRows.filter((r) => r.date === today && r.group === g.id).reduce((s, r) => s + unitVal(r), 0), color: GROUP_COLOR[g.id] || "var(--accent)" }));

  // --- weekly (last 7 days) ---
  const since7 = isoDaysAgo(6);
  const week = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const weeklyTrend = week.map((date) => ({ label: new Date(date).toLocaleDateString("th-TH", { weekday: "short" }), value: catRows.filter((r) => r.date === date).reduce((s, r) => s + unitVal(r), 0), color }));
  const weekRows = catRows.filter((r) => r.date >= since7);
  const weeklyTotal = railBuckets.length
    ? bucketBars(weekRows, unitVal)
    : aggBy(weekRows, (r) => r.name, unitVal).map((d) => ({ ...d, color }));
  const segWeek = customerGroups.map((g) => ({ label: g.name_en ?? g.name, value: weekRows.filter((r) => r.group === g.id).reduce((s, r) => s + unitVal(r), 0), color: GROUP_COLOR[g.id] || "var(--accent)" }));
  const weeklySum = weeklyTrend.reduce((a, b) => a + b.value, 0);

  // --- monthly (last 30 days) ---
  const monthRows = catRows;
  const topSkus = aggBy(monthRows, (r) => r.sku, (r) => r.qty, (r) => r.name)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const monthlyWeeks = [...Array(4)].map((_, i) => {
    const start = isoDaysAgo((4 - i) * 7 - 1 + 7);
    const end = isoDaysAgo((3 - i) * 7);
    const value = monthRows.filter((r) => r.date >= start && r.date <= end).reduce((s, r) => s + unitVal(r), 0);
    return { label: `W${i + 1}`, value, color };
  });
  const segMonth = customerGroups.map((g) => ({ label: g.name_en ?? g.name, value: monthRows.filter((r) => r.group === g.id).reduce((s, r) => s + unitVal(r), 0), color: GROUP_COLOR[g.id] || "var(--accent)" }));

  // rows for the currently selected period → drives the per-SKU rail breakdown
  const periodRows = tab === "daily" ? dailyRows : tab === "weekly" ? weekRows : monthRows;
  const railProducts = products.filter((p) => p.category_id === catId && (p.size || p.variant || p.length_m != null));

  return (
    <div className="fade-up">
      <ScreenHead th="รายงาน" en="Reports · separated by category, never mixing units" right={<Btn kind="default" icon="download" size="sm">ส่งออก Excel</Btn>} />

      {/* period + category selectors */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", background: "var(--surface-3)", borderRadius: 11, padding: 4 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, background: tab === t.id ? "var(--surface)" : "transparent", color: tab === t.id ? "var(--ink)" : "var(--ink-3)", boxShadow: tab === t.id ? "var(--sh-1)" : "none" }}
            >
              {t.th} <span className="en">{t.en}</span>
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 26, background: "var(--border-2)" }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCatId(c.id)}
              style={{
                padding: "8px 13px",
                borderRadius: 99,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 7,
                border: "1px solid " + (catId === c.id ? CAT_COLOR[c.id] || "var(--accent)" : "var(--border-2)"),
                background: catId === c.id ? CAT_COLOR[c.id] || "var(--accent)" : "var(--surface)",
                color: catId === c.id ? "#fff" : "var(--ink-2)",
              }}
            >
              {c.name} <span style={{ fontSize: 11, opacity: 0.8 }}>· {c.report_unit_th}</span>
            </button>
          ))}
        </div>
      </div>

      {/* category band */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: color + "12", marginBottom: 16 }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <Icon name={CAT_ICON[catId] || "box"} size={20} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700 }}>{cat.name} <span className="en">{cat.name_en}</span></div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
            หน่วยรายงาน: <strong style={{ color: "var(--ink-2)" }}>{cat.report_unit_th}</strong>
            {cat.secondary_unit_th ? ` + ${cat.secondary_unit_th}` : ""}
          </div>
        </div>
      </div>

      {tab === "daily" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: cat.report_unit === "m" ? "repeat(3,1fr)" : "repeat(2,1fr)", gap: 14 }}>
            <Stat label="การใช้วันนี้" value={dailyHeadline.toLocaleString()} sub={cat.report_unit_th} icon="bolt" accent={color} />
            {cat.report_unit === "m" && <Stat label="จำนวนเส้น" value={dailyPieces.toLocaleString()} sub="เส้น" icon="grid" />}
            <Stat label="สต็อกใกล้หมด" value={lowCount.length} sub={`${lowCount.filter((p) => stockStatus(p) === "red").length} ต่ำกว่าขั้นต่ำ`} icon="alert" accent="var(--red)" />
          </div>
          {cat.viz === "rail" ? (
            <Panel title="การใช้ตามขนาดราง" en="By rail size · pieces">{dailyBySize.some((d) => d.value) ? <MiniBars data={dailyBySize} /> : <Empty msg="ยังไม่มีการใช้งานวันนี้" />}</Panel>
          ) : (
            <Panel title="การใช้ตามสินค้า" en={`By product · ${cat.report_unit_th}`}>{dailyByProduct.length ? <SegBars data={dailyByProduct} /> : <Empty msg="ยังไม่มีการใช้งานวันนี้" />}</Panel>
          )}
          <Panel title="การใช้ตามกลุ่มลูกค้า" en={`By customer segment · ${cat.report_unit_th}`}>
            {segDaily.some((d) => d.value) ? <SegBars data={segDaily} /> : <Empty msg="ยังไม่มีการใช้งานวันนี้" />}
          </Panel>
        </div>
      )}

      {tab === "weekly" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
          <Panel title={`แนวโน้มการใช้ (${cat.report_unit_th}/วัน)`} en="Usage trend this week"><MiniBars height={180} data={weeklyTrend} /></Panel>
          <Panel title="สัดส่วนตามกลุ่มลูกค้า" en={`Segment share · ${cat.report_unit_th}`}>{segWeek.some((d) => d.value) ? <Donut data={segWeek} /> : <Empty msg="ยังไม่มีข้อมูลสัปดาห์นี้" />}</Panel>
          <div style={{ gridColumn: "1 / -1" }}>
            <Panel title="สรุปการใช้รายสัปดาห์" en={`Weekly total · ${weeklySum.toLocaleString()} ${cat.report_unit_th}`}>
              {weeklyTotal.some((d) => d.value) ? <SegBars data={weeklyTotal} /> : <Empty msg="ยังไม่มีข้อมูลสัปดาห์นี้" />}
            </Panel>
          </div>
        </div>
      )}

      {tab === "monthly" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
          <Panel title="SKU ที่ใช้มากที่สุด" en={`Top SKUs · ${cat.report_unit_th === "เมตร" ? "เส้น" : cat.report_unit_th}`} pad={0}>
            {topSkus.length ? (
              <DataTable cols={[{ label: "#", w: 40 }, { label: "SKU", w: 120 }, { label: "ชื่อสินค้า" }, { label: "จำนวน", right: true, w: 110 }]}>
                {topSkus.map((r, i) => (
                  <tr key={r.label} style={{ borderBottom: "1px solid var(--surface-3)" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--ink-3)" }}>{i + 1}</td>
                    <td style={{ padding: "12px 14px" }}><span className="mono" style={{ fontSize: 12.5 }}>{r.label}</span></td>
                    <td style={{ padding: "12px 14px", fontWeight: 600 }}>{r.name}</td>
                    <td className="tnum" style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700 }}>{r.value.toLocaleString()}</td>
                  </tr>
                ))}
              </DataTable>
            ) : (
              <Empty msg="ยังไม่มีข้อมูลในช่วง 30 วัน" />
            )}
          </Panel>
          <Panel title="สัดส่วนตามกลุ่มลูกค้า" en={`Segment share · ${cat.report_unit_th}`}>{segMonth.some((d) => d.value) ? <Donut data={segMonth} /> : <Empty msg="ยังไม่มีข้อมูล" />}</Panel>
          <div style={{ gridColumn: "1 / -1" }}>
            <Panel title="แนวโน้มการบริโภค 4 สัปดาห์" en={`Consumption trend · ${cat.report_unit_th}`}><MiniBars data={monthlyWeeks} /></Panel>
          </div>
        </div>
      )}

      {cat.viz === "rail" && (
        <div style={{ marginTop: 16 }}>
          <RailSkuBreakdown products={railProducts} rows={periodRows} />
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 12.5, color: "var(--ink-3)", display: "flex", gap: 7, alignItems: "center" }}>
        <Icon name="lock" size={14} /> ทุกหมวดหมู่รายงานด้วยหน่วยของตัวเอง — ระบบไม่นำหน่วยที่ต่างกันมารวมยอดข้ามหมวด
      </div>
    </div>
  );
}

/* per-SKU rail breakdown, grouped by rail type (pieces + meters), for the period. */
function RailSkuBreakdown({ products, rows }: { products: Product[]; rows: ReportRow[] }) {
  const skuPieces: Record<string, number> = {};
  rows.forEach((r) => {
    skuPieces[r.sku] = (skuPieces[r.sku] || 0) + r.qty;
  });
  const groups = railGroups(products);
  const hasAny = Object.values(skuPieces).some((v) => v > 0);

  return (
    <Panel title="การใช้ราย SKU แยกตามชนิดราง" en="Usage by SKU · per rail type · pieces / meters" pad={hasAny ? 8 : 0}>
      {!hasAny ? (
        <Empty msg="ยังไม่มีการใช้งานในช่วงนี้" />
      ) : (
        groups.map((g) => {
          const items = g.items;
          const sizePieces = items.reduce((s, p) => s + (skuPieces[p.sku] || 0), 0);
          const sizeMeters = items.reduce((s, p) => s + (skuPieces[p.sku] || 0) * (p.length_m || 0), 0);
          return (
            <div key={g.key} style={{ margin: 8, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{g.label}</span>
                <span className="tnum" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                  รวม {sizePieces.toLocaleString()} เส้น · {sizeMeters.toLocaleString()} ม.
                </span>
              </div>
              {items.map((p) => {
                const pcs = skuPieces[p.sku] || 0;
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: "1px solid var(--surface-3)" }}>
                    <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)", width: 104 }}>{p.sku}</span>
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{p.length}</span>
                    <span className="tnum" style={{ fontWeight: 700, fontSize: 14.5 }}>
                      {pcs.toLocaleString()} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-3)" }}>เส้น</span>
                    </span>
                    <span className="tnum" style={{ width: 90, textAlign: "right", color: "var(--ink-3)", fontSize: 12.5 }}>
                      {(pcs * (p.length_m || 0)).toLocaleString()} ม.
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </Panel>
  );
}

/* aggregate rows by a key, summing a numeric accessor; keeps an optional name. */
function aggBy(
  rows: ReportRow[],
  key: (r: ReportRow) => string,
  val: (r: ReportRow) => number,
  name?: (r: ReportRow) => string,
): { label: string; value: number; name: string }[] {
  const map = new Map<string, { label: string; value: number; name: string }>();
  for (const r of rows) {
    const k = key(r);
    const e = map.get(k) ?? { label: k, value: 0, name: name ? name(r) : k };
    e.value += val(r);
    map.set(k, e);
  }
  return [...map.values()].filter((e) => e.value > 0).sort((a, b) => b.value - a.value);
}
