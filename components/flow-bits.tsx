import { Fragment, type ReactNode } from "react";
import { DataTable } from "@/components/ui";

/* ---- 4-step progress dots (Stock Input + reused patterns) ---- */
export function StepDots({ active, labels }: { active: number; labels: string[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {labels.map((l, i) => (
        <Fragment key={i}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: i <= active ? "var(--accent)" : "var(--surface-3)",
                color: i <= active ? "#fff" : "var(--ink-4)",
              }}
            >
              {i < active ? "✓" : i + 1}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: i === active ? "var(--ink)" : "var(--ink-4)", whiteSpace: "nowrap" }}>
              {l}
            </span>
          </div>
          {i < labels.length - 1 && <span style={{ width: 16, height: 1, background: "var(--border-2)" }} />}
        </Fragment>
      ))}
    </div>
  );
}

/* ---- labelled value (review screens) ---- */
export function KV({ k, en, v }: { k: ReactNode; en?: ReactNode; v: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
        {k} {en && <span className="en" style={{ fontSize: 10.5 }}>{en}</span>}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2, textTransform: "capitalize" }}>{v}</div>
    </div>
  );
}

/* ---- transaction history table (shared) ---- */
export type TxnRow = {
  date: string;
  sku: string;
  typeLabel: string;
  qty: number;
  note: string | null;
  by: string | null;
};

export function HistoryTable({ rows, highlight = 0 }: { rows: TxnRow[]; highlight?: number }) {
  return (
    <DataTable
      cols={[
        { label: "วันที่", w: 110 },
        { label: "SKU", w: 120 },
        { label: "ประเภท", w: 90 },
        { label: "จำนวน", right: true, w: 80 },
        { label: "หมายเหตุ" },
        { label: "โดย", w: 80 },
      ]}
    >
      {rows.map((r, i) => (
        <tr
          key={i}
          style={{ borderBottom: "1px solid var(--surface-3)", background: i < highlight ? "var(--green-soft)" : "transparent" }}
        >
          <td className="mono" style={{ padding: "11px 14px", fontSize: 12.5, color: "var(--ink-2)" }}>
            {r.date}
          </td>
          <td style={{ padding: "11px 14px" }}>
            <span className="mono" style={{ fontSize: 12.5 }}>
              {r.sku}
            </span>
          </td>
          <td style={{ padding: "11px 14px" }}>
            <span className={`pill ${r.qty >= 0 ? "green" : "amber"}`}>{r.typeLabel}</span>
          </td>
          <td
            className="tnum"
            style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700, color: r.qty >= 0 ? "var(--green-ink)" : "var(--amber-ink)" }}
          >
            {r.qty >= 0 ? `+${r.qty}` : r.qty}
          </td>
          <td style={{ padding: "11px 14px", color: "var(--ink-2)" }}>{r.note || "—"}</td>
          <td className="mono" style={{ padding: "11px 14px", fontSize: 12, color: "var(--ink-3)" }}>
            {r.by}
          </td>
        </tr>
      ))}
      {rows.length === 0 && (
        <tr>
          <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>
            ยังไม่มีประวัติ
          </td>
        </tr>
      )}
    </DataTable>
  );
}
