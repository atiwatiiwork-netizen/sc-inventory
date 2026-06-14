"use client";

import { useMemo, useState } from "react";
import { type Category, type Product, stockStatus } from "@/lib/types";
import { DataTable, Panel, ScreenHead, SearchBox } from "@/components/ui";
import { Btn } from "@/components/ui";
import { StatusMatrix, Legend } from "@/components/charts";

export function InventoryClient({ categories, products }: { categories: Category[]; products: Product[] }) {
  const [cat, setCat] = useState(categories[0]?.id ?? "");
  const [q, setQ] = useState("");
  const current = categories.find((c) => c.id === cat);

  const list = useMemo(() => {
    const query = q.toLowerCase();
    return products.filter(
      (p) =>
        p.category_id === cat &&
        (!q || p.name.includes(q) || (p.name_en ?? "").toLowerCase().includes(query) || p.sku.toLowerCase().includes(query)),
    );
  }, [products, cat, q]);

  const isRail = current?.viz === "rail";

  return (
    <div className="fade-up">
      <ScreenHead
        th="สต็อกปัจจุบัน"
        en="Current Inventory"
        right={
          <div style={{ display: "flex", gap: 10 }}>
            <SearchBox value={q} onChange={setQ} placeholder="ค้นหา SKU / ชื่อ" />
            <Btn kind="default" icon="download" size="sm">Excel</Btn>
          </div>
        }
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            style={{
              padding: "8px 14px",
              borderRadius: 99,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid " + (cat === c.id ? "var(--accent)" : "var(--border-2)"),
              background: cat === c.id ? "var(--accent)" : "var(--surface)",
              color: cat === c.id ? "#fff" : "var(--ink-2)",
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {isRail && !q && (
        <Panel title="ตารางสต็อกรางเหล็ก" en="Size × Length matrix" style={{ marginBottom: 16 }} right={<Legend />}>
          <StatusMatrix products={products.filter((p) => p.category_id === cat)} />
        </Panel>
      )}

      <Panel title={`รายการสินค้า · ${current?.name ?? ""}`} en={`${list.length} SKU`} pad={0}>
        <DataTable
          cols={[
            { label: "SKU", w: 120 },
            { label: "ชื่อสินค้า" },
            { label: "หน่วย", w: 70 },
            { label: "คงเหลือ", right: true, w: 90 },
            { label: "ขั้นต่ำ", right: true, w: 80 },
            { label: "สถานะ", w: 110 },
          ]}
        >
          {list.map((p) => {
            const st = stockStatus(p);
            return (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--surface-3)" }}>
                <td style={{ padding: "11px 14px" }}><span className="mono" style={{ fontSize: 12.5 }}>{p.sku}</span></td>
                <td style={{ padding: "11px 14px", fontWeight: 600 }}>{p.name} <span className="en" style={{ fontSize: 11 }}>{p.name_en}</span></td>
                <td style={{ padding: "11px 14px", color: "var(--ink-3)" }}>{p.unit}</td>
                <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700, fontSize: 14.5 }}>{p.stock}</td>
                <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", color: "var(--ink-3)" }}>{p.min_stock}</td>
                <td style={{ padding: "11px 14px" }}>
                  <span className={`pill ${st}`}>{st === "green" ? "ปกติ" : st === "amber" ? "ใกล้หมด" : "ต่ำกว่าขั้นต่ำ"}</span>
                </td>
              </tr>
            );
          })}
          {list.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 28, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>ไม่พบสินค้า</td>
            </tr>
          )}
        </DataTable>
      </Panel>
    </div>
  );
}
