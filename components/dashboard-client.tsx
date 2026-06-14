"use client";

import { useMemo, useState } from "react";
import { type Category, type Product, stockStatus } from "@/lib/types";
import type { WorkerStatus } from "@/lib/queries";
import { buildConsumption, coverLabel, inUnit, LOOKBACK_DAYS, type Movement } from "@/lib/insights";
import { CAT_ICON, CAT_COLOR, SIZE_COLOR } from "@/lib/nav";
import { Icon } from "@/components/icon";
import { Btn, Panel, ScreenHead, Stat, DataTable } from "@/components/ui";
import { MiniBars, SegBars } from "@/components/charts";

type Props = {
  categories: Category[];
  products: Product[];
  movements: Movement[];
  todayUsage: Record<string, number>;
  workerStatus: WorkerStatus[];
  today: string;
};

export function DashboardClient(props: Props) {
  const { categories, products, todayUsage, workerStatus } = props;
  const [detail, setDetail] = useState<string | null>(null);

  const consumption = useMemo(() => buildConsumption(props.movements), [props.movements]);
  const fmtDate = new Date(props.today).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

  const catUsage = (catId: string) => {
    let pieces = 0;
    let meters = 0;
    for (const p of products) {
      if (p.category_id !== catId) continue;
      const q = todayUsage[p.id] || 0;
      if (!q) continue;
      pieces += q;
      if (p.length_m) meters += p.length_m * q;
    }
    return { pieces, meters };
  };
  const catAvgDaily = (cat: Category) => {
    let used = 0;
    for (const m of props.movements) {
      if (m.product?.category_id !== cat.id) continue;
      used += inUnit(cat.report_unit, Math.abs(m.qty), m.product.length_m);
    }
    return used / LOOKBACK_DAYS;
  };
  const catLow = (catId: string) => {
    let red = 0;
    let amber = 0;
    for (const p of products) {
      if (p.category_id !== catId) continue;
      const st = stockStatus(p);
      if (st === "red") red++;
      else if (st === "amber") amber++;
    }
    return { red, amber, low: red + amber };
  };

  if (detail) {
    const cat = categories.find((c) => c.id === detail);
    if (cat)
      return (
        <CategoryDashboard
          cat={cat}
          products={products}
          movements={props.movements}
          todayUsage={todayUsage}
          consumption={consumption}
          onBack={() => setDetail(null)}
        />
      );
  }

  const submitted = workerStatus.filter((w) => w.status === "submitted").length;
  const totalLow = products.filter((p) => stockStatus(p) !== "green").length;
  const totalRed = products.filter((p) => stockStatus(p) === "red").length;

  return (
    <div className="fade-up">
      <ScreenHead th="แดชบอร์ด" en={`Overview · ${fmtDate}`} right={<Btn kind="default" icon="download" size="sm">ส่งออก Excel</Btn>} />

      {/* operational strip — counts only, never mixes units */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
        <Stat label="ส่งข้อมูลแล้ววันนี้" value={`${submitted}/${workerStatus.length || 0}`} sub="พนักงาน" icon="user" accent={submitted === workerStatus.length && submitted > 0 ? "var(--green)" : "var(--amber)"} />
        <Stat label="หมวดหมู่ที่ติดตาม" value={categories.length} sub={`${products.length} SKU รวม`} icon="layers" />
        <Stat label="รายการสต็อกใกล้หมด" value={totalLow} sub={`${totalRed} รายการต่ำกว่าขั้นต่ำ`} icon="alert" accent={totalRed ? "var(--red)" : "var(--green)"} />
      </div>

      {/* category cards — each in its OWN reporting unit */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "0 2px 12px" }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>การใช้วันนี้ตามหมวดหมู่</span>
        <span className="en">Today&apos;s usage by category · each in its own unit</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
        {categories.map((c) => {
          const u = catUsage(c.id);
          const low = catLow(c.id);
          const color = CAT_COLOR[c.id] || "var(--accent)";
          const value = c.report_unit === "m" ? u.meters : u.pieces;
          const avg = catAvgDaily(c);
          return (
            <div key={c.id} className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 18px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 11, background: color + "1a", color, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <Icon name={CAT_ICON[c.id] || "box"} size={21} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                    <div className="en" style={{ fontSize: 11 }}>{c.name_en}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>การใช้วันนี้ <span className="en" style={{ fontSize: 10.5 }}>Today&apos;s usage</span></div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                    <span className="tnum" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.02em", color }}>{value.toLocaleString()}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-2)" }}>{c.report_unit_th}</span>
                  </div>
                  {c.report_unit === "m" && <div className="tnum" style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 1 }}>{u.pieces.toLocaleString()} {c.secondary_unit_th}</div>}
                  {/* dynamic insight — informational only */}
                  <div className="tnum" style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 6 }}>
                    เฉลี่ย {avg > 0 ? avg.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"} {c.report_unit_th}/วัน · {LOOKBACK_DAYS} วัน
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: low.low ? (low.red ? "var(--red-ink)" : "var(--amber-ink)") : "var(--ink-3)" }}>
                  <span className={`dot ${low.red ? "red" : low.amber ? "amber" : "green"}`} /> สต็อกใกล้หมด {low.low}
                </span>
                <button onClick={() => setDetail(c.id)} style={{ border: "none", background: "none", color: "var(--accent)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 3, cursor: "pointer" }}>
                  ดูรายละเอียด <Icon name="chevR" size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* worker submission status — operational, unit-free */}
      <Panel title="สถานะการส่งข้อมูลวันนี้" en="Worker submissions" pad={0}>
        {workerStatus.map((s) => {
          const done = s.status === "submitted";
          return (
            <div key={s.code} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: "1px solid var(--surface-3)" }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: done ? "var(--green-soft)" : "var(--amber-soft)", color: done ? "var(--green)" : "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <Icon name={done ? "check" : "clock"} size={19} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>
                  {s.name} <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 400 }}>{s.code}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{done ? `${s.groupName} · ${s.itemCount} รายการ` : "ยังไม่ได้ส่งข้อมูล"}</div>
              </div>
              {done ? <span className="pill green"><span className="mono">{s.time}</span></span> : <span className="pill amber">รอดำเนินการ</span>}
            </div>
          );
        })}
        {workerStatus.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>ยังไม่มีพนักงาน</div>}
      </Panel>
    </div>
  );
}

/* ---- category drill-down (visualization by viz type) ---- */
function CategoryDashboard({
  cat,
  products,
  movements,
  todayUsage,
  consumption,
  onBack,
}: {
  cat: Category;
  products: Product[];
  movements: Movement[];
  todayUsage: Record<string, number>;
  consumption: Record<string, { used: number; avgDaily: number }>;
  onBack: () => void;
}) {
  const color = CAT_COLOR[cat.id] || "var(--accent)";
  const items = products.filter((p) => p.category_id === cat.id);
  const lowList = items
    .filter((p) => stockStatus(p) !== "green")
    .sort((a, b) => a.stock / Math.max(a.min_stock, 1) - b.stock / Math.max(b.min_stock, 1));

  // today usage
  let pieces = 0;
  let meters = 0;
  const bySize: Record<string, number> = {};
  const byProduct: Record<string, number> = {};
  for (const p of items) {
    const q = todayUsage[p.id] || 0;
    if (!q) continue;
    pieces += q;
    byProduct[p.id] = q;
    if (p.length_m) {
      meters += p.length_m * q;
      if (p.size) bySize[p.size] = (bySize[p.size] || 0) + q;
    }
  }
  const low = { red: lowList.filter((p) => stockStatus(p) === "red").length, low: lowList.length };
  const sizes = [...new Set(items.filter((p) => p.size).map((p) => p.size!))];

  // weekly trend (last 7 days, in category unit)
  const last7 = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const weekly = last7.map((date) => {
    let v = 0;
    for (const m of movements) {
      if (m.product?.category_id !== cat.id || m.txn_date !== date) continue;
      v += inUnit(cat.report_unit, Math.abs(m.qty), m.product.length_m);
    }
    return { label: new Date(date).toLocaleDateString("th-TH", { weekday: "short" }), value: v };
  });

  // dynamic insight — top SKUs by average daily usage
  const insight = items
    .map((p) => ({ p, avg: consumption[p.id]?.avgDaily ?? 0 }))
    .filter((x) => x.avg > 0)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 6);

  const productBars = Object.entries(byProduct)
    .map(([id, q]) => ({ p: items.find((x) => x.id === id)!, q }))
    .filter((x) => x.p)
    .sort((a, b) => b.q - a.q)
    .map((x) => ({ label: x.p.name, value: x.q, color }));

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <button onClick={onBack} style={{ border: "1px solid var(--border-2)", background: "var(--surface)", borderRadius: 10, padding: "7px 12px", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
          <Icon name="chevL" size={16} /> แดชบอร์ด
        </button>
        <span style={{ fontSize: 13, color: "var(--ink-4)" }}>/</span>
        <span style={{ fontSize: 13, color: "var(--ink-3)" }}>หมวดหมู่</span>
      </div>
      <ScreenHead th={cat.name} en={`${cat.name_en} · หน่วยรายงาน: ${cat.report_unit_th}`} right={<Btn kind="default" icon="download" size="sm">ส่งออก Excel</Btn>} />

      {cat.viz === "rail" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 16 }}>
            <Stat label="เมตรที่ใช้วันนี้" value={meters.toLocaleString()} sub="เมตร (ความยาว × จำนวน)" icon="bolt" accent={color} />
            <Stat label="จำนวนเส้นที่ใช้" value={pieces.toLocaleString()} sub="เส้น" icon="grid" />
            <Stat label="SKU ใกล้หมด" value={low.low} sub={`${low.red} ต่ำกว่าขั้นต่ำ`} icon="alert" accent={low.red ? "var(--red)" : "var(--green)"} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 16, marginBottom: 16 }}>
            <Panel title="การใช้ตามขนาดราง" en="Usage by rail size · pieces">
              <MiniBars data={sizes.map((s) => ({ label: s, value: bySize[s] || 0, color: SIZE_COLOR[s] }))} />
            </Panel>
            <Panel title="เมตรที่ใช้ตามขนาด" en="Meters consumed by size">
              <SegBars
                data={sizes.map((s) => ({
                  label: `ราง ${s}`,
                  value: items.filter((p) => p.size === s).reduce((m, p) => m + (byProduct[p.id] || 0) * (p.length_m || 0), 0),
                  color: SIZE_COLOR[s],
                }))}
              />
            </Panel>
          </div>
          <ConsumptionInsight items={insight} unitTh={cat.report_unit_th} />
          <Panel title="สต็อกใกล้หมดตาม SKU" en="Low stock by SKU" pad={0} style={{ marginTop: 16 }}>
            <LowBySku items={lowList} />
          </Panel>
        </>
      ) : cat.viz === "trend" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 16 }}>
            <Stat label="การใช้วันนี้" value={pieces.toLocaleString()} sub={cat.report_unit_th} icon="bolt" accent={color} />
            <Stat label="SKU ในหมวด" value={items.length} sub="รายการ" icon="layers" />
            <Stat label="วัสดุใกล้หมด" value={low.low} sub={`${low.red} ต่ำกว่าขั้นต่ำ`} icon="alert" accent={low.red ? "var(--red)" : "var(--green)"} />
          </div>
          <Panel title="แนวโน้มการบริโภค (7 วันล่าสุด)" en={`Consumption trend · ${cat.report_unit_th}`} style={{ marginBottom: 16 }}>
            <MiniBars height={170} data={weekly.map((d) => ({ ...d, color }))} />
          </Panel>
          <ConsumptionInsight items={insight} unitTh={cat.report_unit_th} />
          <Panel title="วัสดุใกล้หมด" en="Low stock materials" pad={0} style={{ marginTop: 16 }}>
            <LowBySku items={lowList} />
          </Panel>
        </>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 16 }}>
            <Stat label="การใช้วันนี้" value={pieces.toLocaleString()} sub={cat.report_unit_th} icon="bolt" accent={color} />
            <Stat label="SKU ในหมวด" value={items.length} sub="รายการ" icon="layers" />
            <Stat label="สินค้าใกล้หมด" value={low.low} sub={`${low.red} ต่ำกว่าขั้นต่ำ`} icon="alert" accent={low.red ? "var(--red)" : "var(--green)"} />
          </div>
          <Panel title="การใช้ตามสินค้า" en={`Usage by product · ${cat.report_unit_th}`} style={{ marginBottom: 16 }}>
            {productBars.length ? <SegBars data={productBars} /> : <div style={{ padding: 24, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>ยังไม่มีการใช้งานวันนี้</div>}
          </Panel>
          <ConsumptionInsight items={insight} unitTh={cat.report_unit_th} />
          <Panel title="สินค้าใกล้หมด" en="Low stock products" pad={0} style={{ marginTop: 16 }}>
            <LowBySku items={lowList} />
          </Panel>
        </>
      )}
    </div>
  );
}

/* ---- dynamic consumption insight (informational only) ---- */
function ConsumptionInsight({ items, unitTh }: { items: { p: Product; avg: number }[]; unitTh: string | null }) {
  return (
    <Panel
      title="ข้อมูลการบริโภค (ประกอบการตัดสินใจ)"
      en={`Avg daily usage · est. days of cover · last ${LOOKBACK_DAYS} days · does not affect status`}
      pad={0}
    >
      {items.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>ยังไม่มีข้อมูลการใช้ย้อนหลังเพียงพอ</div>
      ) : (
        <DataTable
          cols={[
            { label: "SKU", w: 120 },
            { label: "ชื่อสินค้า" },
            { label: "คงเหลือ", right: true, w: 90 },
            { label: "ใช้/วัน", right: true, w: 90 },
            { label: "พอใช้อีก", right: true, w: 110 },
          ]}
        >
          {items.map(({ p, avg }) => (
            <tr key={p.id} style={{ borderBottom: "1px solid var(--surface-3)" }}>
              <td style={{ padding: "11px 14px" }}><span className="mono" style={{ fontSize: 12.5 }}>{p.sku}</span></td>
              <td style={{ padding: "11px 14px", fontWeight: 600 }}>{p.name}</td>
              <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700 }}>{p.stock} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-3)" }}>{p.unit}</span></td>
              <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", color: "var(--ink-2)" }}>{avg.toFixed(1)}</td>
              <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", color: "var(--ink-2)" }}>{coverLabel(p.stock, avg)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </Panel>
  );
}

function LowBySku({ items }: { items: Product[] }) {
  if (!items.length) return <div style={{ padding: 28, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>ไม่มีรายการใกล้หมดในหมวดนี้</div>;
  return (
    <DataTable
      cols={[
        { label: "", w: 30 },
        { label: "SKU", w: 120 },
        { label: "ชื่อสินค้า" },
        { label: "คงเหลือ", right: true, w: 90 },
        { label: "ขั้นต่ำ", right: true, w: 80 },
        { label: "สถานะ", w: 110 },
      ]}
    >
      {items.map((p) => {
        const st = stockStatus(p);
        return (
          <tr key={p.id} style={{ borderBottom: "1px solid var(--surface-3)" }}>
            <td style={{ padding: "11px 14px" }}><span className={`dot ${st}`} /></td>
            <td style={{ padding: "11px 14px" }}><span className="mono" style={{ fontSize: 12.5 }}>{p.sku}</span></td>
            <td style={{ padding: "11px 14px", fontWeight: 600 }}>{p.name}</td>
            <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700, color: st === "red" ? "var(--red)" : "var(--amber-ink)" }}>{p.stock} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-3)" }}>{p.unit}</span></td>
            <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", color: "var(--ink-3)" }}>{p.min_stock}</td>
            <td style={{ padding: "11px 14px" }}><span className={`pill ${st}`}>{st === "red" ? "ต่ำกว่าขั้นต่ำ" : "ใกล้หมด"}</span></td>
          </tr>
        );
      })}
    </DataTable>
  );
}
