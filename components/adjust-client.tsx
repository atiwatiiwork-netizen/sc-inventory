"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import { Btn, DataTable, Field, Panel, ScreenHead, SelectInput, TextInput, inputStyle } from "@/components/ui";
import { recordAdjustment } from "@/app/admin/(console)/adjustments/actions";

export type AdjustRow = {
  date: string;
  sku: string;
  name: string;
  sys: number;
  act: number;
  diff: number;
  note: string | null;
  by: string | null;
};

export function AdjustClient({ products, history }: { products: Product[]; history: AdjustRow[] }) {
  const router = useRouter();
  const [sku, setSku] = useState(products[0]?.id ?? "");
  const [actual, setActual] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const p = products.find((x) => x.id === sku);
  const diff = actual === "" || !p ? null : Number(actual) - p.stock;

  const save = () => {
    if (!p || actual === "") return;
    setMsg(null);
    start(async () => {
      const res = await recordAdjustment({ productId: p.id, actual: Number(actual), note });
      if (res.ok) {
        setMsg({ ok: true, text: `บันทึกแล้ว · ผลต่าง ${res.diff && res.diff > 0 ? "+" + res.diff : res.diff}` });
        setActual("");
        setNote("");
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error || "บันทึกไม่สำเร็จ" });
      }
    });
  };

  const diffBg = diff === null ? "var(--surface-2)" : diff === 0 ? "var(--green-soft)" : diff > 0 ? "var(--accent-soft)" : "var(--red-soft)";
  const diffFg = diff === null ? "var(--ink-4)" : diff === 0 ? "var(--green-ink)" : diff > 0 ? "var(--accent-ink)" : "var(--red-ink)";

  return (
    <div className="fade-up">
      <ScreenHead th="ปรับปรุงสต็อก" en="Stock Adjustments · physical count" />
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 16, alignItems: "start" }}>
        <Panel title="นับสต็อกจริง" en="Reconcile count">
          <Field label="สินค้า (SKU)" en="Product">
            <SelectInput value={sku} onChange={(e) => { setSku(e.target.value); setActual(""); setMsg(null); }}>
              {products.map((x) => (
                <option key={x.id} value={x.id}>{x.sku} · {x.name}</option>
              ))}
            </SelectInput>
          </Field>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Field label="ในระบบ" en="System">
                <div style={{ ...inputStyle, background: "var(--surface-2)", fontWeight: 700, fontSize: 18 }} className="tnum">{p?.stock ?? 0}</div>
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="นับได้จริง" en="Actual">
                <TextInput inputMode="numeric" value={actual} onChange={(e) => setActual(e.target.value.replace(/\D/g, ""))} placeholder="0" style={{ fontWeight: 700, fontSize: 18 }} />
              </Field>
            </div>
          </div>
          <Field label="ผลต่าง" en="Difference">
            <div className="tnum" style={{ ...inputStyle, background: diffBg, color: diffFg, fontWeight: 700, fontSize: 18 }}>
              {diff === null ? "—" : diff > 0 ? `+${diff}` : diff}
            </div>
          </Field>
          <Field label="หมายเหตุ" en="Reason">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ชำรุด / นับเกิน" />
          </Field>
          {msg && (
            <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: msg.ok ? "var(--green-soft)" : "var(--red-soft)", color: msg.ok ? "var(--green-ink)" : "var(--red-ink)" }}>
              {msg.text}
            </div>
          )}
          <Btn kind="primary" full icon="check" disabled={pending || actual === ""} onClick={save}>
            {pending ? "กำลังบันทึก…" : "บันทึกการปรับปรุง"}
          </Btn>
        </Panel>

        <Panel title="ประวัติการปรับปรุง" en="Adjustment history" pad={0}>
          <DataTable
            cols={[
              { label: "วันที่", w: 110 },
              { label: "SKU", w: 120 },
              { label: "ระบบ", right: true, w: 70 },
              { label: "จริง", right: true, w: 70 },
              { label: "ผลต่าง", right: true, w: 80 },
              { label: "เหตุผล" },
            ]}
          >
            {history.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--surface-3)" }}>
                <td className="mono" style={{ padding: "11px 14px", fontSize: 12.5, color: "var(--ink-2)" }}>{r.date}</td>
                <td style={{ padding: "11px 14px" }}><span className="mono" style={{ fontSize: 12.5 }}>{r.sku}</span></td>
                <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", color: "var(--ink-3)" }}>{r.sys}</td>
                <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", fontWeight: 600 }}>{r.act}</td>
                <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700, color: r.diff === 0 ? "var(--ink-3)" : r.diff > 0 ? "var(--accent)" : "var(--red)" }}>{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                <td style={{ padding: "11px 14px", color: "var(--ink-2)" }}>{r.note || "—"}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>ยังไม่มีประวัติ</td></tr>
            )}
          </DataTable>
        </Panel>
      </div>
    </div>
  );
}
