"use client";

import { useMemo, useState, useTransition } from "react";
import type { WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { suggestRawSku } from "@/lib/wheels/sku";
import { versionLabel, sizeLabel, grooveLabel } from "@/lib/wheels/grouping";
import { Icon } from "@/components/icon";
import { Btn, Field, Panel, ScreenHead, TextInput, Toggle } from "@/components/ui";
import { StepDots } from "@/components/flow-bits";
import { saveRawWheelsBulk, type RawInput, type BulkResult } from "@/app/admin/(console)/wheels/raw/actions";

type Step = "select" | "fill" | "review" | "done";
const STEPS = ["เลือกชุด", "กรอกข้อมูล", "ตรวจทาน", "เสร็จ"];

type Draft = {
  version: string;
  size: string;
  groove: string;
  sku: string;
  name: string;
  unit: string;
  min: string;
  order: string;
  active: boolean;
};

const comboKey = (version: string, size: string, groove: string) => `${version}|${size}|${groove}`;

export function RawBulkClient({
  raw,
  finishes,
  sizes,
  grooves,
  onClose,
  onDone,
}: {
  raw: WheelRaw[];
  finishes: WheelLookup[];
  sizes: WheelLookup[];
  grooves: WheelLookup[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<Step>("select");
  const [version, setVersion] = useState(finishes[0]?.id ?? "");
  const [basket, setBasket] = useState<Record<string, Draft>>({});
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // existing finish×size×groove combos (cannot recreate) + existing SKUs (dup check)
  const existingCombos = useMemo(() => new Set(raw.map((r) => comboKey(r.finish, r.size, r.groove))), [raw]);
  const existingSkus = useMemo(() => new Set(raw.map((r) => r.sku.trim().toLowerCase())), [raw]);

  const newDraft = (v: string, s: string, g: string): Draft => ({
    version: v,
    size: s,
    groove: g,
    sku: suggestRawSku(v, s, g),
    name: "",
    unit: "ลูก",
    min: "",
    order: "",
    active: true,
  });

  const toggleCombo = (s: string, g: string) => {
    const key = comboKey(version, s, g);
    if (existingCombos.has(key)) return;
    setBasket((b) => {
      const n = { ...b };
      if (n[key]) delete n[key];
      else n[key] = newDraft(version, s, g);
      return n;
    });
  };

  const selectAllInVersion = () => {
    setBasket((b) => {
      const n = { ...b };
      for (const s of sizes)
        for (const g of grooves) {
          const key = comboKey(version, s.id, g.id);
          if (!existingCombos.has(key) && !n[key]) n[key] = newDraft(version, s.id, g.id);
        }
      return n;
    });
  };

  const patch = (key: string, p: Partial<Draft>) => setBasket((b) => ({ ...b, [key]: { ...b[key], ...p } }));
  const removeRow = (key: string) =>
    setBasket((b) => {
      const n = { ...b };
      delete n[key];
      return n;
    });

  // basket rows ordered Version → Size → Groove
  const orderedRows = useMemo(() => {
    const vOrder = (id: string) => finishes.findIndex((x) => x.id === id);
    const sOrder = (id: string) => sizes.findIndex((x) => x.id === id);
    const gOrder = (id: string) => grooves.findIndex((x) => x.id === id);
    return Object.entries(basket)
      .map(([key, d]) => ({ key, d }))
      .sort((a, b) => vOrder(a.d.version) - vOrder(b.d.version) || sOrder(a.d.size) - sOrder(b.d.size) || gOrder(a.d.groove) - gOrder(b.d.groove));
  }, [basket, finishes, sizes, grooves]);

  const count = orderedRows.length;

  // duplicate-SKU detection across existing + within the basket
  const skuIssues = useMemo(() => {
    const seen = new Map<string, number>();
    for (const { d } of orderedRows) {
      const k = d.sku.trim().toLowerCase();
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    const issues: Record<string, string> = {};
    for (const { key, d } of orderedRows) {
      const k = d.sku.trim().toLowerCase();
      if (!k) issues[key] = "กรุณากรอก SKU";
      else if (existingSkus.has(k)) issues[key] = "SKU ซ้ำกับที่มีอยู่";
      else if ((seen.get(k) ?? 0) > 1) issues[key] = "SKU ซ้ำกันในรายการ";
    }
    return issues;
  }, [orderedRows, existingSkus]);
  const hasIssues = Object.keys(skuIssues).length > 0;

  const confirm = () => {
    setError(null);
    const inputs: RawInput[] = orderedRows.map(({ d }) => ({
      sku: d.sku,
      name: d.name,
      finish: d.version,
      size: d.size,
      groove: d.groove,
      unit: d.unit,
      min_stock: Number(d.min) || 0,
      display_order: Number(d.order) || 0,
      active: d.active,
    }));
    start(async () => {
      const res = await saveRawWheelsBulk(inputs);
      if (!res.ok && res.error) setError(res.error);
      else {
        setResult(res);
        setStep("done");
        onDone();
      }
    });
  };

  const stepIndex = { select: 0, fill: 1, review: 2, done: 3 }[step];
  const combiLabel = (d: Draft) => `${versionLabel(finishes, d.version)} ${sizeLabel(sizes, d.size)} ${grooveLabel(grooves, d.groove)}`;

  /* ---------- header ---------- */
  const head = (
    <ScreenHead
      th="เพิ่มล้อดิบหลายรายการ"
      en="Bulk add raw wheels"
      right={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <StepDots active={stepIndex} labels={STEPS} />
          <Btn kind="ghost" size="sm" icon="x" onClick={onClose}>
            ปิด
          </Btn>
        </div>
      }
    />
  );

  /* ---------- STEP: select ---------- */
  if (step === "select")
    return (
      <div className="fade-up">
        {head}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="รุ่น/เวอร์ชัน" en="Version">
            <select
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              style={{ width: 240, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", fontSize: 14 }}
            >
              {finishes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.th} · {f.en}
                </option>
              ))}
            </select>
          </Field>
          <Btn kind="soft" size="sm" icon="check" onClick={selectAllInVersion}>
            เลือกทั้งหมดในรุ่นนี้
          </Btn>
          {count > 0 && <span className="pill green tnum">เลือกแล้ว {count} รายการ</span>}
        </div>

        <Panel title={`เลือกชุด — ${versionLabel(finishes, version)}`} en="Size × Groove · คลิกเพื่อเลือก">
          <div style={{ overflowX: "auto" }} className="scroll">
            <table style={{ borderCollapse: "separate", borderSpacing: 8 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 12, color: "var(--ink-3)", padding: "0 8px" }}>Size \\ Groove</th>
                  {grooves.map((g) => (
                    <th key={g.id} style={{ fontSize: 12.5, fontWeight: 700, padding: "0 8px", minWidth: 96 }}>
                      {g.en}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sizes.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontSize: 13, fontWeight: 700, padding: "0 8px", whiteSpace: "nowrap" }}>
                      <span className="pill blue">{s.en}</span>
                    </td>
                    {grooves.map((g) => {
                      const key = comboKey(version, s.id, g.id);
                      const exists = existingCombos.has(key);
                      const picked = !!basket[key];
                      return (
                        <td key={g.id}>
                          <button
                            type="button"
                            disabled={exists}
                            onClick={() => toggleCombo(s.id, g.id)}
                            className="focusable"
                            style={{
                              width: "100%",
                              minWidth: 92,
                              height: 52,
                              borderRadius: 12,
                              fontSize: 12.5,
                              fontWeight: 600,
                              cursor: exists ? "default" : "pointer",
                              border: `1px solid ${picked ? "var(--accent)" : "var(--border-2)"}`,
                              background: exists ? "var(--surface-3)" : picked ? "var(--accent-soft)" : "var(--surface)",
                              color: exists ? "var(--ink-4)" : picked ? "var(--accent-ink)" : "var(--ink-2)",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 2,
                            }}
                          >
                            {exists ? (
                              <>
                                <Icon name="check" size={14} />
                                <span style={{ fontSize: 10.5 }}>มีอยู่แล้ว</span>
                              </>
                            ) : picked ? (
                              <>
                                <Icon name="check" size={16} />
                                <span style={{ fontSize: 10.5 }}>เลือก</span>
                              </>
                            ) : (
                              <span style={{ color: "var(--accent)" }}>+ เพิ่ม</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
          <Btn kind="ghost" onClick={onClose} disabled={pending}>
            ยกเลิก
          </Btn>
          <Btn kind="primary" size="lg" icon="chevR" disabled={count === 0} style={{ opacity: count === 0 ? 0.5 : 1 }} onClick={() => count > 0 && setStep("fill")}>
            กรอกข้อมูล ({count})
          </Btn>
        </div>
      </div>
    );

  /* ---------- STEP: fill ---------- */
  if (step === "fill")
    return (
      <div className="fade-up">
        {head}
        <Panel title="กรอกข้อมูลแต่ละรายการ" en="SKU แนะนำให้อัตโนมัติ · แก้ไขได้" pad={0}>
          <div style={{ overflowX: "auto" }} className="scroll">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["รายการ", "SKU", "ชื่อ/หมายเหตุ", "หน่วย", "ขั้นต่ำ", "ลำดับ", "ใช้งาน", ""].map((h, i) => (
                    <th key={i} style={{ textAlign: i >= 4 && i <= 5 ? "right" : "left", padding: "8px 10px", fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderedRows.map(({ key, d }) => (
                  <tr key={key} style={{ borderBottom: "1px solid var(--surface-3)" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>{combiLabel(d)}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <input
                        value={d.sku}
                        onChange={(e) => patch(key, { sku: e.target.value })}
                        style={{ width: 150, padding: "7px 9px", borderRadius: 8, fontSize: 12.5, border: `1px solid ${skuIssues[key] ? "var(--red)" : "var(--border-2)"}`, background: "var(--surface)" }}
                      />
                      {skuIssues[key] && <div style={{ fontSize: 10.5, color: "var(--red-ink)", marginTop: 2 }}>{skuIssues[key]}</div>}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <input value={d.name} onChange={(e) => patch(key, { name: e.target.value })} placeholder="(ถ้ามี)" style={{ width: 160, padding: "7px 9px", borderRadius: 8, fontSize: 12.5, border: "1px solid var(--border-2)", background: "var(--surface)" }} />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <input value={d.unit} onChange={(e) => patch(key, { unit: e.target.value })} style={{ width: 64, padding: "7px 9px", borderRadius: 8, fontSize: 12.5, border: "1px solid var(--border-2)", background: "var(--surface)" }} />
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>
                      <input inputMode="numeric" value={d.min} onChange={(e) => patch(key, { min: e.target.value.replace(/\D/g, "") })} placeholder="0" style={{ width: 56, padding: "7px 9px", borderRadius: 8, fontSize: 12.5, textAlign: "right", border: "1px solid var(--border-2)", background: "var(--surface)" }} />
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>
                      <input inputMode="numeric" value={d.order} onChange={(e) => patch(key, { order: e.target.value.replace(/\D/g, "") })} placeholder="0" style={{ width: 56, padding: "7px 9px", borderRadius: 8, fontSize: 12.5, textAlign: "right", border: "1px solid var(--border-2)", background: "var(--surface)" }} />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <Toggle on={d.active} onChange={(v) => patch(key, { active: v })} />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <button onClick={() => removeRow(key)} title="เอาออก" style={{ border: "none", background: "var(--red-soft)", color: "var(--red-ink)", borderRadius: 8, width: 30, height: 30 }}>
                        <Icon name="x" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 16 }}>
          <Btn kind="default" icon="chevL" onClick={() => setStep("select")} disabled={pending}>
            กลับไปเลือก
          </Btn>
          <Btn kind="primary" size="lg" icon="chevR" disabled={count === 0 || hasIssues} style={{ opacity: count === 0 || hasIssues ? 0.5 : 1 }} onClick={() => setStep("review")}>
            ตรวจทาน ({count})
          </Btn>
        </div>
        {hasIssues && <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--red-ink)", fontWeight: 600 }}>มี SKU ซ้ำหรือว่าง — แก้ก่อนจึงจะไปต่อได้</div>}
      </div>
    );

  /* ---------- STEP: review ---------- */
  if (step === "review")
    return (
      <div className="fade-up">
        {head}
        <Panel title="ตรวจทานก่อนสร้าง" en={`${count} รายการ · ยังไม่บันทึกจนกว่าจะยืนยัน`}>
          {orderedRows.map(({ key, d }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 4px", borderBottom: "1px solid var(--surface-3)" }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)", width: 150 }}>{d.sku}</span>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{combiLabel(d)}{d.name ? ` · ${d.name}` : ""}</span>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{d.unit} · ขั้นต่ำ {Number(d.min) || 0}</span>
              <span className={`pill ${d.active ? "green" : "grey"}`}>{d.active ? "ใช้งาน" : "ปิด"}</span>
            </div>
          ))}
        </Panel>
        {error && (
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 16 }}>
          <Btn kind="default" icon="edit" onClick={() => setStep("fill")} disabled={pending}>
            แก้ไข
          </Btn>
          <Btn kind="primary" size="lg" icon="check" onClick={confirm} disabled={pending}>
            {pending ? "กำลังสร้าง…" : `ยืนยันสร้าง ${count} รายการ`}
          </Btn>
        </div>
      </div>
    );

  /* ---------- STEP: done ---------- */
  return (
    <div className="fade-up">
      {head}
      <Panel>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "6px 2px" }}>
          <span style={{ width: 52, height: 52, borderRadius: 99, background: "var(--green)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Icon name="check" size={28} stroke={2.6} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>สร้างล้อดิบเรียบร้อย · {result?.created ?? 0} รายการ</div>
            {result?.skipped.length ? (
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>ข้าม {result.skipped.length} รายการ: {result.skipped.map((s) => `${s.sku} (${s.reason})`).join(", ")}</div>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>เพิ่มลงแคตตาล็อกแล้ว</div>
            )}
          </div>
          <Btn kind="default" icon="plus" onClick={() => { setBasket({}); setResult(null); setStep("select"); }}>
            เพิ่มชุดใหม่
          </Btn>
          <Btn kind="primary" onClick={onClose}>เสร็จสิ้น</Btn>
        </div>
      </Panel>
    </div>
  );
}
