"use client";

import { useMemo, useState } from "react";
import { ScreenHead, SearchBox, Panel } from "@/components/ui";

export type StockItem = {
  sku: string;
  name: string; // Version → Size → Groove
  note: string | null; // optional box display name
  stock: number;
  unit: string;
};

/**
 * Phase B2 pilot — finished-goods availability. Shows only what is actually on
 * hand for the pilot packed-box SKUs. No targets, shortages, or suggestions.
 */
export function StockCheckClient({ items }: { items: StockItem[] }) {
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((i) => !query || i.sku.toLowerCase().includes(query) || i.name.toLowerCase().includes(query) || (i.note ?? "").toLowerCase().includes(query));
  }, [items, q]);

  return (
    <div className="fade-up" style={{ maxWidth: 620, margin: "0 auto" }}>
      <ScreenHead th="เช็คสต็อกพร้อมขาย" en="Stock Reality Check · มีของไหม ตอนนี้" />
      <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 14 }}>
        สต็อกสินค้าสำเร็จรูป (กล่องบรรจุ) ที่มีอยู่จริงตอนนี้ · ชุดนำร่อง {items.length} รายการ
      </div>
      <div style={{ marginBottom: 14 }}>
        <SearchBox value={q} onChange={setQ} placeholder="ค้นหา SKU / ชื่อสินค้า" />
      </div>

      <Panel pad={0}>
        {list.map((i) => {
          const inStock = i.stock > 0;
          return (
            <div
              key={i.sku}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--surface-3)" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{i.name}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>
                  {i.sku}
                  {i.note ? <span className="en" style={{ marginLeft: 6 }}>· {i.note}</span> : null}
                </div>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                <div className="tnum" style={{ fontSize: 22, fontWeight: 700, color: inStock ? "var(--ink)" : "var(--ink-4)" }}>
                  {i.stock.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-3)" }}>{i.unit}</span>
                </div>
                <span className={`pill ${inStock ? "green" : "grey"}`} style={{ marginTop: 2, display: "inline-block" }}>
                  {inStock ? "มีของ" : "หมด"}
                </span>
              </div>
            </div>
          );
        })}
        {list.length === 0 && (
          <div style={{ padding: 26, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>
            {items.length === 0 ? "ยังไม่มีสินค้าสำเร็จรูปในชุดนำร่อง" : "ไม่พบรายการที่ค้นหา"}
          </div>
        )}
      </Panel>
    </div>
  );
}
