"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { ScreenHead, SearchBox, Panel } from "@/components/ui";

/** One finished-good SKU with its passive availability snapshot (precomputed server-side). */
export type PacItem = {
  layer: "box" | "assembly";
  sku: string;
  name: string; // Version → Size → Groove (box) or assembly name
  note: string | null;
  unit: string;
  stock: number;
  minStock: number;
  status: "green" | "amber" | "red";
  todayProduction: number;
  todaySales: number;
  lastProduction: { date: string; time: string; qty: number } | null;
  lastSale: { date: string; time: string; qty: number } | null;
};

const STATUS: Record<PacItem["status"], { pill: string; th: string; en: string }> = {
  green: { pill: "green", th: "พร้อมขาย", en: "Available" },
  amber: { pill: "amber", th: "สต็อกน้อย · มีการผลิตวันนี้", en: "Low · produced today" },
  red: { pill: "red", th: "สต็อกน้อย · ไม่มีการผลิตวันนี้", en: "Low · no production today" },
};

/** Format a stored event { date, time, qty } as a single readable line. */
function eventLine(e: { date: string; time: string; qty: number } | null, unit: string): { main: string; sub: string } {
  if (!e) return { main: "—", sub: "ยังไม่มีรายการ" };
  return { main: `${e.qty.toLocaleString()} ${unit}`, sub: `${e.date} · ${e.time}` };
}

/**
 * Sprint 5A — Product Availability Check (PAC). Passive, read-only office screen:
 * search one finished-good SKU and immediately see whether to say yes to a customer.
 * Reuses existing balances + the wheels_transactions ledger; no new data entry.
 */
export function PacClient({ items }: { items: PacItem[] }) {
  const [q, setQ] = useState("");
  const [sku, setSku] = useState<string | null>(null);

  const selected = useMemo(() => items.find((i) => i.sku === sku) ?? null, [items, sku]);

  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter(
      (i) =>
        i.sku.toLowerCase().includes(query) ||
        i.name.toLowerCase().includes(query) ||
        (i.note ?? "").toLowerCase().includes(query),
    );
  }, [items, q]);

  return (
    <div className="fade-up" style={{ maxWidth: 620, margin: "0 auto" }}>
      <ScreenHead th="เช็คสินค้าให้ลูกค้า" en="Product Availability Check · ตอบลูกค้าได้ทันที" />
      <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 14 }}>
        ค้นหา SKU เพื่อดูสต็อกปัจจุบัน · การผลิตวันนี้ · การขายวันนี้ · ความเคลื่อนไหวล่าสุด (ดูอย่างเดียว ไม่ต้องบันทึกอะไร)
      </div>

      <div style={{ marginBottom: 14 }}>
        <SearchBox value={q} onChange={setQ} placeholder="ค้นหา SKU / ชื่อสินค้า" />
      </div>

      {selected ? (
        <PacDetail item={selected} onClear={() => setSku(null)} />
      ) : (
        <Panel pad={0}>
          {matches.map((i) => {
            const s = STATUS[i.status];
            return (
              <button
                key={i.sku}
                onClick={() => {
                  setSku(i.sku);
                  setQ("");
                }}
                className="focusable"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  textAlign: "left",
                  padding: "14px 16px",
                  border: "none",
                  borderBottom: "1px solid var(--surface-3)",
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--ink)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{i.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>
                    {i.sku}
                    {i.note ? <span className="en" style={{ marginLeft: 6 }}>· {i.note}</span> : null}
                  </div>
                </div>
                <span className={`pill ${s.pill}`} style={{ flex: "none" }}>
                  {i.status === "green" ? "พร้อมขาย" : "สต็อกน้อย"}
                </span>
                <Icon name="chevR" size={16} style={{ color: "var(--ink-4)", flex: "none" }} />
              </button>
            );
          })}
          {matches.length === 0 && (
            <div style={{ padding: 26, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>
              {items.length === 0 ? "ยังไม่มีสินค้าสำเร็จรูป" : "ไม่พบรายการที่ค้นหา"}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

/** Full passive snapshot for one selected SKU. */
function PacDetail({ item, onClear }: { item: PacItem; onClear: () => void }) {
  const s = STATUS[item.status];
  const lastProd = eventLine(item.lastProduction, item.unit);
  const lastSale = eventLine(item.lastSale, item.unit);

  return (
    <div className="fade-up">
      <button
        onClick={onClear}
        className="focusable"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: "none",
          background: "transparent",
          color: "var(--accent)",
          fontWeight: 600,
          fontSize: 13.5,
          cursor: "pointer",
          marginBottom: 12,
          padding: 0,
        }}
      >
        <Icon name="chevR" size={15} style={{ transform: "rotate(180deg)" }} /> เปลี่ยน SKU
      </button>

      {/* Top: SKU + availability status */}
      <Panel pad={18} style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 700 }}>{item.name}</div>
            <div className="mono" style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 3 }}>
              {item.sku}
              {item.note ? <span className="en" style={{ marginLeft: 6 }}>· {item.note}</span> : null}
            </div>
          </div>
          <span className={`pill ${s.pill}`} style={{ flex: "none", fontSize: 13, padding: "5px 12px" }}>
            {s.th}
          </span>
        </div>
      </Panel>

      {/* Three "today" figures */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
        <Figure label="สต็อกปัจจุบัน" en="Current Stock" value={item.stock} unit={item.unit} accent />
        <Figure label="ผลิตวันนี้" en="Today's Production" value={item.todayProduction} unit={item.unit} />
        <Figure label="ขายวันนี้" en="Today's Sales" value={item.todaySales} unit={item.unit} />
      </div>

      {/* Last movements */}
      <Panel pad={0}>
        <EventRow icon="clock" label="การผลิตล่าสุด" en="Last Production" main={lastProd.main} sub={lastProd.sub} />
        <EventRow icon="store" label="การขายล่าสุด" en="Last Sale" main={lastSale.main} sub={lastSale.sub} last />
      </Panel>
    </div>
  );
}

function Figure({ label, en, value, unit, accent }: { label: string; en: string; value: number; unit: string; accent?: boolean }) {
  return (
    <div className="card" style={{ padding: "14px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>{label}</span>
      <div className="tnum" style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.02em", color: accent ? "var(--accent)" : "var(--ink)" }}>
        {value.toLocaleString()}
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink-3)", marginLeft: 4 }}>{unit}</span>
      </div>
      <span className="en" style={{ fontSize: 10.5 }}>{en}</span>
    </div>
  );
}

function EventRow({
  icon,
  label,
  en,
  main,
  sub,
  last,
}: {
  icon: "clock" | "store";
  label: string;
  en: string;
  main: string;
  sub: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderBottom: last ? "none" : "1px solid var(--surface-3)",
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "var(--surface-3)",
          color: "var(--ink-3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        <Icon name={icon} size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {label} <span className="en" style={{ fontSize: 11 }}>{en}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 1 }}>{sub}</div>
      </div>
      <div className="tnum" style={{ fontSize: 16, fontWeight: 700, flex: "none" }}>{main}</div>
    </div>
  );
}
