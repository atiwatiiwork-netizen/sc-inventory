"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category, Product } from "@/lib/types";
import { Btn, DataTable, Field, Panel, ScreenHead, SelectInput, TextInput, inputStyle } from "@/components/ui";
import { Icon } from "@/components/icon";
import { recordAdjustment, resetCategory } from "@/app/admin/(console)/adjustments/actions";

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

export function AdjustClient({ products, categories, history }: { products: Product[]; categories: Category[]; history: AdjustRow[] }) {
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

      <div style={{ marginTop: 16, maxWidth: 760 }}>
        <ResetPanel categories={categories} onDone={() => router.refresh()} />
      </div>
    </div>
  );
}

/* bulk reset a whole category's stock to 0 (testing / fixing many at once) */
function ResetPanel({ categories, onDone }: { categories: Category[]; onDone: () => void }) {
  const [cat, setCat] = useState(categories[0]?.id ?? "");
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const catName = categories.find((c) => c.id === cat)?.name ?? "";

  const run = () => {
    setMsg(null);
    start(async () => {
      const res = await resetCategory(cat);
      setConfirming(false);
      if (res.ok) {
        setMsg({ ok: true, text: `รีเซ็ตหมวด "${catName}" เป็น 0 แล้ว · ${res.diff ?? 0} รายการ` });
        onDone();
      } else {
        setMsg({ ok: false, text: res.error || "รีเซ็ตไม่สำเร็จ" });
      }
    });
  };

  return (
    <Panel title="รีเซ็ตทั้งหมวดเป็น 0" en="Reset a whole category · for testing">
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, background: "var(--amber-soft)", color: "var(--amber-ink)", fontSize: 12.5, lineHeight: 1.6, marginBottom: 14 }}>
        <Icon name="alert" size={15} style={{ flex: "none", marginTop: 1 }} /> ตั้งสต็อกของทุก SKU ในหมวดที่เลือกให้เป็น 0 (บันทึกเป็นการปรับปรุง) · ใช้ตอนทดสอบหรือแก้ทีละหมวด — ย้อนกลับไม่ได้
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Field label="หมวดหมู่" en="Category">
            <SelectInput value={cat} onChange={(e) => { setCat(e.target.value); setConfirming(false); setMsg(null); }}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </SelectInput>
          </Field>
        </div>
        {confirming ? (
          <div style={{ display: "flex", gap: 8 }}>
            <Btn kind="ghost" onClick={() => setConfirming(false)} disabled={pending}>ยกเลิก</Btn>
            <Btn kind="danger" icon="trash" onClick={run} disabled={pending}>{pending ? "กำลังรีเซ็ต…" : "ยืนยันรีเซ็ตเป็น 0"}</Btn>
          </div>
        ) : (
          <Btn kind="danger" icon="refresh" onClick={() => setConfirming(true)} disabled={pending}>รีเซ็ตหมวดนี้เป็น 0</Btn>
        )}
      </div>
      {msg && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: msg.ok ? "var(--green-soft)" : "var(--red-soft)", color: msg.ok ? "var(--green-ink)" : "var(--red-ink)" }}>
          {msg.text}
        </div>
      )}
    </Panel>
  );
}
