import { createClient } from "@/lib/supabase/server";
import { type Category, type Product, stockStatus } from "@/lib/types";
import { getMovements } from "@/lib/queries";
import { buildConsumption, coverLabel, LOOKBACK_DAYS } from "@/lib/insights";
import { Icon } from "@/components/icon";
import { DataTable, Panel, ScreenHead, Stat } from "@/components/ui";
import { LowStockAlertButton, type AlertCategory } from "@/components/low-stock-alert-button";

export default async function LowStockPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: cats }, movements] = await Promise.all([
    supabase.from("products").select("*").eq("active", true),
    supabase.from("categories").select("*").order("display_order"),
    getMovements(supabase),
  ]);

  const all = (products ?? []) as Product[];
  const categories = (cats ?? []) as Category[];
  const consumption = buildConsumption(movements);

  const items = all
    .filter((p) => stockStatus(p) !== "green")
    .sort((a, b) => a.stock / Math.max(a.min_stock, 1) - b.stock / Math.max(b.min_stock, 1));
  const reds = items.filter((p) => stockStatus(p) === "red");
  const normal = all.length - items.length;

  // Group low-stock items by category, preserving category display order and
  // the urgency sort within each group. Items with no category fall into "อื่นๆ".
  const NONE = "__none__";
  const grouped = new Map<string, Product[]>();
  for (const p of items) {
    const key = p.category_id ?? NONE;
    (grouped.get(key) ?? grouped.set(key, []).get(key)!).push(p);
  }
  const orderedKeys = [
    ...categories.map((c) => c.id).filter((id) => grouped.has(id)),
    ...(grouped.has(NONE) ? [NONE] : []),
  ];
  const catName = (key: string) => (key === NONE ? "ไม่ระบุหมวดหมู่" : categories.find((c) => c.id === key)?.name ?? key);

  // Categories offered in the LINE alert modal (only those with low items).
  const alertCategories: AlertCategory[] = orderedKeys
    .filter((k) => k !== NONE)
    .map((k) => {
      const list = grouped.get(k)!;
      return {
        id: k,
        name: catName(k),
        redCount: list.filter((p) => stockStatus(p) === "red").length,
        amberCount: list.filter((p) => stockStatus(p) === "amber").length,
      };
    });

  return (
    <div className="fade-up">
      <ScreenHead
        th="สต็อกใกล้หมด"
        en="Low Stock Alerts"
        right={<LowStockAlertButton categories={alertCategories} />}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 16 }}>
        <Stat label="ต่ำกว่าขั้นต่ำ" value={reds.length} sub="ต้องสั่งผลิตด่วน" icon="alert" accent="var(--red)" />
        <Stat label="ใกล้ถึงขั้นต่ำ" value={items.length - reds.length} sub="ภายใน 20% ของขั้นต่ำ" icon="alert" accent="var(--amber)" />
        <Stat label="สถานะปกติ" value={normal} sub={`จาก ${all.length} SKU`} icon="check" accent="var(--green)" />
      </div>

      <Panel title="รายการที่ต้องเติมสต็อก" en="Reorder list · จัดกลุ่มตามหมวดหมู่" pad={0}>
        <DataTable
          cols={[
            { label: "", w: 30 },
            { label: "SKU", w: 120 },
            { label: "ชื่อสินค้า" },
            { label: "คงเหลือ", right: true, w: 90 },
            { label: "ขั้นต่ำ", right: true, w: 80 },
            { label: "ขาด", right: true, w: 80 },
            { label: "ใช้/วัน", right: true, w: 90 },
            { label: "พอใช้อีก", right: true, w: 100 },
            { label: "สถานะ", w: 110 },
          ]}
        >
          {orderedKeys.map((key) => {
            const list = grouped.get(key)!;
            return (
              <GroupRows key={key} title={catName(key)} count={list.length}>
                {list.map((p) => {
                  const st = stockStatus(p);
                  const gap = p.min_stock - p.stock;
                  const avg = consumption[p.id]?.avgDaily ?? 0;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--surface-3)" }}>
                      <td style={{ padding: "11px 14px" }}><span className={`dot ${st}`} /></td>
                      <td style={{ padding: "11px 14px" }}><span className="mono" style={{ fontSize: 12.5 }}>{p.sku}</span></td>
                      <td style={{ padding: "11px 14px", fontWeight: 600 }}>{p.name}</td>
                      <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700, color: st === "red" ? "var(--red)" : "var(--amber-ink)" }}>{p.stock}</td>
                      <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", color: "var(--ink-3)" }}>{p.min_stock}</td>
                      <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", fontWeight: 600 }}>{gap > 0 ? `−${gap}` : "—"}</td>
                      <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", color: "var(--ink-2)" }}>{avg > 0 ? avg.toFixed(1) : "—"}</td>
                      <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", color: "var(--ink-2)" }}>{coverLabel(p.stock, avg)}</td>
                      <td style={{ padding: "11px 14px" }}><span className={`pill ${st}`}>{st === "red" ? "ต่ำกว่าขั้นต่ำ" : "ใกล้หมด"}</span></td>
                    </tr>
                  );
                })}
              </GroupRows>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={9} style={{ padding: 28, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>
                ไม่มีรายการใกล้หมด · สต็อกทั้งหมดอยู่ในเกณฑ์ปกติ
              </td>
            </tr>
          )}
        </DataTable>
      </Panel>

      <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--ink-3)", display: "flex", gap: 7, alignItems: "flex-start", lineHeight: 1.6 }}>
        <Icon name="doc" size={14} style={{ flex: "none", marginTop: 2 }} />
        <span>
          สีสถานะกำหนดจาก <strong>สต็อกขั้นต่ำที่ตั้งไว้</strong> (แดง: ต่ำกว่าขั้นต่ำ · เหลือง: ภายใน 20% ของขั้นต่ำ) ·
          คอลัมน์ <strong>ใช้/วัน</strong> และ <strong>พอใช้อีก</strong> เป็นข้อมูลประกอบการตัดสินใจ คำนวณจากการใช้จริงย้อนหลัง {LOOKBACK_DAYS} วัน
          และไม่มีผลต่อสีสถานะ
        </span>
      </div>
    </div>
  );
}

/** A category subheader row followed by its item rows. */
function GroupRows({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <>
      <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--surface-3)" }}>
        <td colSpan={9} style={{ padding: "8px 14px", fontWeight: 700, fontSize: 12.5, color: "var(--ink-2)" }}>
          {title} <span style={{ fontWeight: 500, color: "var(--ink-3)" }}>· {count} รายการ</span>
        </td>
      </tr>
      {children}
    </>
  );
}
