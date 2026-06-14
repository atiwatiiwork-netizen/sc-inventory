"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category, Product } from "@/lib/types";
import { entryGroups } from "@/lib/grouping";
import { Icon } from "@/components/icon";
import { Btn, Field, Panel, ScreenHead, TextInput } from "@/components/ui";
import { StepDots, KV, HistoryTable, type TxnRow } from "@/components/flow-bits";
import { receiveStock } from "@/app/admin/(console)/stock-input/actions";

type Step = "category" | "entry" | "review" | "done";
const STEPS = ["หมวดหมู่", "กรอกจำนวน", "ตรวจทาน", "เสร็จ"];

export function StockInputClient({
  categories,
  products,
  history,
  today,
}: {
  categories: Category[];
  products: Product[];
  history: TxnRow[];
  today: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("category");
  const [date, setDate] = useState(today);
  const [catId, setCatId] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const cat = categories.find((c) => c.id === catId) ?? null;
  const groups = cat ? entryGroups(cat, products) : [];
  const setOne = (id: string, v: string) =>
    setQty((q) => {
      const n = { ...q };
      const num = Number(v) || 0;
      if (num) n[id] = num;
      else delete n[id];
      return n;
    });
  const groupTotal = (ids: string[]) => ids.reduce((s, id) => s + (qty[id] || 0), 0);
  const grand = Object.values(qty).reduce((a, b) => a + b, 0);
  const filled = Object.keys(qty).length;

  const restart = () => {
    setStep("category");
    setCatId(null);
    setQty({});
    setNote("");
    setError(null);
  };

  const commit = () => {
    setError(null);
    const lines = Object.entries(qty).map(([product_id, q]) => ({ product_id, qty: q }));
    start(async () => {
      const res = await receiveStock({ date, note, lines });
      if (res.ok) {
        setSavedCount(res.count ?? filled);
        setStep("done");
        router.refresh();
      } else {
        setError(res.error || "บันทึกไม่สำเร็จ");
      }
    });
  };

  /* ---------- STEP: pick category ---------- */
  if (step === "category")
    return (
      <div className="fade-up">
        <ScreenHead th="รับสินค้าเข้า" en="Stock Input · grouped receiving" right={<StepDots active={0} labels={STEPS} />} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, alignItems: "start" }}>
          <Panel title="เลือกหมวดหมู่ที่รับเข้า" en="Step 1 · choose a category to receive">
            <div style={{ marginBottom: 14 }}>
              <Field label="วันที่รับเข้า" en="Transaction date">
                <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 200 }} />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
              {categories.map((c) => {
                const count = products.filter((p) => p.category_id === c.id && p.active).length;
                const grpCount = entryGroups(c, products).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCatId(c.id);
                      setQty({});
                      setStep("entry");
                    }}
                    className="card focusable"
                    style={{ padding: 16, display: "flex", alignItems: "center", gap: 13, textAlign: "left", cursor: "pointer", border: "1px solid var(--border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  >
                    <span style={{ width: 46, height: 46, borderRadius: 13, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                      <Icon name="layers" size={22} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 700 }}>{c.name}</div>
                      <div className="en" style={{ fontSize: 11.5 }}>
                        {c.name_en} · {count} SKU · {grpCount} กลุ่ม
                      </div>
                    </div>
                    <Icon name="chevR" size={20} style={{ color: "var(--ink-4)" }} />
                  </button>
                );
              })}
            </div>
          </Panel>
          <Panel title="ประวัติการรับเข้า / เคลื่อนไหว" en="Recent transactions" pad={0}>
            <HistoryTable rows={history.slice(0, 7)} />
          </Panel>
        </div>
      </div>
    );

  /* ---------- STEP: grouped entry ---------- */
  if (step === "entry")
    return (
      <div className="fade-up">
        <ScreenHead th="รับสินค้าเข้า" en={`Step 2 · ${cat?.name}`} right={<StepDots active={1} labels={STEPS} />} />
        <div style={{ maxWidth: 760 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <button onClick={restart} style={{ border: "1px solid var(--border-2)", background: "var(--surface)", borderRadius: 10, padding: "8px 12px", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
              <Icon name="chevL" size={16} /> เปลี่ยนหมวดหมู่
            </button>
            <span className="pill blue">{cat?.name}</span>
            <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
              วันที่ <span className="mono">{date}</span>
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {groups.map((g) => {
              const gt = groupTotal(g.items.map((p) => p.id));
              return (
                <Panel
                  key={g.key}
                  title={g.label}
                  en={`${g.en} · กรอกจำนวน`}
                  right={gt > 0 ? <span className="pill green tnum">+{gt} {g.unit}</span> : <span className="en" style={{ fontSize: 12 }}>{g.items.length} SKU</span>}
                >
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(g.items.length, 4)}, 1fr)`, gap: 12 }}>
                    {g.items.map((p) => (
                      <div key={p.id}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 5 }}>
                          {p.length || p.name}
                          <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)", fontWeight: 400 }}>{p.sku}</div>
                        </div>
                        <input
                          className="tnum focusable"
                          inputMode="numeric"
                          value={qty[p.id] || ""}
                          placeholder="0"
                          onChange={(e) => setOne(p.id, e.target.value.replace(/\D/g, "").slice(0, 5))}
                          style={{
                            width: "100%",
                            height: 56,
                            textAlign: "center",
                            fontSize: 22,
                            fontWeight: 700,
                            borderRadius: 12,
                            border: "1px solid var(--border-2)",
                            background: qty[p.id] ? "var(--accent-soft)" : "var(--surface-2)",
                            color: qty[p.id] ? "var(--accent-ink)" : "var(--ink-4)",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </Panel>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18, padding: "14px 18px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 13.5, color: "var(--ink-2)" }}>
              ช่องว่าง = 0 อัตโนมัติ · <span className="en">empty = zero</span>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>รวมรับเข้า</div>
              <div className="tnum" style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>
                {grand} <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>· {filled} SKU</span>
              </div>
            </div>
            <Btn kind="primary" size="lg" icon="chevR" disabled={grand === 0} style={{ opacity: grand === 0 ? 0.5 : 1 }} onClick={() => grand > 0 && setStep("review")}>
              ตรวจทานก่อนบันทึก
            </Btn>
          </div>
        </div>
      </div>
    );

  /* ---------- STEP: review ---------- */
  if (step === "review")
    return (
      <div className="fade-up">
        <ScreenHead th="ตรวจทานการรับเข้า" en="Step 3 · review before saving" right={<StepDots active={2} labels={STEPS} />} />
        <div style={{ maxWidth: 720 }}>
          <Panel title="สรุปการรับเข้า" en="Nothing is saved until you confirm" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 28, marginBottom: 16 }}>
              <KV k="วันที่รับเข้า" en="Date" v={<span className="mono">{date}</span>} />
              <KV k="หมวดหมู่" en="Category" v={cat?.name} />
              <KV k="จำนวน SKU" en="Line items" v={`${filled} รายการ`} />
            </div>
            {groups
              .filter((g) => groupTotal(g.items.map((p) => p.id)) > 0)
              .map((g) => (
                <div key={g.key} style={{ marginBottom: 12, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                      {g.label} <span className="en">{g.en}</span>
                    </span>
                    <span className="pill green tnum">+{groupTotal(g.items.map((p) => p.id))} {g.unit}</span>
                  </div>
                  {g.items
                    .filter((p) => qty[p.id])
                    .map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: "1px solid var(--surface-3)" }}>
                        <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)", width: 110 }}>{p.sku}</span>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{p.length ? `${g.label} ${p.length}` : p.name}</span>
                        <span className="tnum" style={{ fontSize: 16, fontWeight: 700, color: "var(--green-ink)" }}>+{qty[p.id]}</span>
                      </div>
                    ))}
                </div>
              ))}
            <Field label="หมายเหตุ (ถ้ามี)" en="Notes · optional">
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ล็อตผลิตเดือน มิ.ย. / เลขที่ใบส่งของ" />
            </Field>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderRadius: 12, background: "var(--accent-soft)", marginTop: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-ink)" }}>
                รวมรับเข้าทั้งหมด <span className="en">Overall total</span>
              </span>
              <span className="tnum" style={{ fontSize: 26, fontWeight: 700, color: "var(--accent-ink)" }}>+{grand}</span>
            </div>
          </Panel>
          {error && (
            <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 12 }}>
            <Btn kind="default" size="lg" icon="edit" onClick={() => setStep("entry")} disabled={pending} style={{ flex: "0 0 200px" }}>
              แก้ไข <span className="en">Edit</span>
            </Btn>
            <Btn kind="primary" size="lg" icon="check" onClick={commit} disabled={pending} style={{ flex: 1 }}>
              {pending ? "กำลังบันทึก…" : "ยืนยันและบันทึก"} <span className="en" style={{ color: "rgba(255,255,255,.7)" }}>Confirm &amp; Save</span>
            </Btn>
          </div>
        </div>
      </div>
    );

  /* ---------- STEP: done ---------- */
  return (
    <div className="fade-up">
      <ScreenHead th="รับสินค้าเข้า" en="Stock Input" right={<StepDots active={3} labels={STEPS} />} />
      <div style={{ maxWidth: 720 }}>
        <Panel style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "6px 2px" }}>
            <span style={{ width: 56, height: 56, borderRadius: 99, background: "var(--green)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", animation: "checkPop .45s cubic-bezier(.2,.8,.2,1) both" }}>
              <Icon name="check" size={30} stroke={2.6} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 19, fontWeight: 700 }}>บันทึกรับเข้าเรียบร้อย</div>
              <div style={{ fontSize: 13.5, color: "var(--ink-3)" }}>สต็อกเพิ่มแล้ว · บันทึกประวัติ {savedCount} รายการ (ระดับ SKU)</div>
            </div>
            <Btn kind="primary" icon="plus" onClick={restart}>
              รับเข้ารายการใหม่
            </Btn>
          </div>
        </Panel>
        <Panel title="ประวัติการรับเข้า / เคลื่อนไหว" en="Transaction history · SKU level" pad={0}>
          <HistoryTable rows={history.slice(0, 10)} highlight={savedCount} />
        </Panel>
      </div>
    </div>
  );
}
