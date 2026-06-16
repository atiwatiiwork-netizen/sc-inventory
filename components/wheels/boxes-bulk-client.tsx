"use client";

import { useMemo, useState, useTransition } from "react";
import type { WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { suggestBoxSku, rawWheelLabel } from "@/lib/wheels/sku";
import { versionLabel } from "@/lib/wheels/grouping";
import { Icon } from "@/components/icon";
import { Btn, Field, Panel, ScreenHead, Toggle } from "@/components/ui";
import { StepDots } from "@/components/flow-bits";
import { saveBoxesBulk, type BoxInput, type BulkResult } from "@/app/admin/(console)/wheels/boxes/actions";

type Step = "select" | "fill" | "review" | "done";
const STEPS = ["เลือกล้อดิบ", "กรอกข้อมูล", "ตรวจทาน", "เสร็จ"];

type Draft = {
  rawId: string;
  rawSku: string;
  rawLabel: string;
  version: string;
  size: string;
  groove: string;
  units: string;
  sku: string;
  skuTouched: boolean;
  name: string;
  unit: string;
  min: string;
  order: string;
  active: boolean;
};

export function BoxesBulkClient({
  raw,
  boxes,
  finishes,
  sizes,
  grooves,
  onClose,
  onDone,
}: {
  raw: WheelRaw[];
  boxes: WheelBox[];
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

  const rawByCombo = useMemo(() => {
    const m = new Map<string, WheelRaw>();
    for (const r of raw) m.set(`${r.finish}|${r.size}|${r.groove}`, r);
    return m;
  }, [raw]);
  const boxedRawIds = useMemo(() => new Set(boxes.map((b) => b.raw_id)), [boxes]);
  const existingBoxSkus = useMemo(() => new Set(boxes.map((b) => b.sku.trim().toLowerCase())), [boxes]);

  const newDraft = (r: WheelRaw): Draft => ({
    rawId: r.id,
    rawSku: r.sku,
    rawLabel: rawWheelLabel(r, finishes, sizes, grooves),
    version: r.finish,
    size: r.size,
    groove: r.groove,
    units: "50",
    sku: suggestBoxSku(r.finish, r.size, r.groove, 50),
    skuTouched: false,
    name: "",
    unit: "กล่อง",
    min: "",
    order: "",
    active: true,
  });

  const toggle = (r: WheelRaw) => {
    if (boxedRawIds.has(r.id)) return;
    setBasket((b) => {
      const n = { ...b };
      if (n[r.id]) delete n[r.id];
      else n[r.id] = newDraft(r);
      return n;
    });
  };

  const selectAllInVersion = () => {
    setBasket((b) => {
      const n = { ...b };
      for (const r of raw) {
        if (r.finish === version && !boxedRawIds.has(r.id) && !n[r.id]) n[r.id] = newDraft(r);
      }
      return n;
    });
  };

  const patch = (id: string, p: Partial<Draft>) => setBasket((b) => ({ ...b, [id]: { ...b[id], ...p } }));
  const setUnits = (id: string, v: string) => {
    const units = v.replace(/\D/g, "");
    setBasket((b) => {
      const d = b[id];
      const next = { ...d, units };
      if (!d.skuTouched) next.sku = suggestBoxSku(d.version, d.size, d.groove, Number(units) || 0);
      return { ...b, [id]: next };
    });
  };
  const removeRow = (id: string) =>
    setBasket((b) => {
      const n = { ...b };
      delete n[id];
      return n;
    });

  const orderedRows = useMemo(() => {
    const sOrder = (id: string) => sizes.findIndex((x) => x.id === id);
    const gOrder = (id: string) => grooves.findIndex((x) => x.id === id);
    const vOrder = (id: string) => finishes.findIndex((x) => x.id === id);
    return Object.values(basket).sort(
      (a, b) => vOrder(a.version) - vOrder(b.version) || sOrder(a.size) - sOrder(b.size) || gOrder(a.groove) - gOrder(b.groove),
    );
  }, [basket, finishes, sizes, grooves]);
  const count = orderedRows.length;

  const skuIssues = useMemo(() => {
    const seen = new Map<string, number>();
    for (const d of orderedRows) seen.set(d.sku.trim().toLowerCase(), (seen.get(d.sku.trim().toLowerCase()) ?? 0) + 1);
    const issues: Record<string, string> = {};
    for (const d of orderedRows) {
      const k = d.sku.trim().toLowerCase();
      if (!k) issues[d.rawId] = "กรุณากรอก SKU";
      else if (existingBoxSkus.has(k)) issues[d.rawId] = "SKU ซ้ำกับที่มีอยู่";
      else if ((seen.get(k) ?? 0) > 1) issues[d.rawId] = "SKU ซ้ำกันในรายการ";
      else if (!(Number(d.units) > 0)) issues[d.rawId] = "จำนวนต่อกล่องต้อง > 0";
    }
    return issues;
  }, [orderedRows, existingBoxSkus]);
  const hasIssues = Object.keys(skuIssues).length > 0;

  const confirm = () => {
    setError(null);
    const inputs: BoxInput[] = orderedRows.map((d) => ({
      sku: d.sku,
      name: d.name,
      raw_id: d.rawId,
      units_per_box: Number(d.units) || 0,
      unit: d.unit,
      min_stock: Number(d.min) || 0,
      display_order: Number(d.order) || 0,
      active: d.active,
    }));
    start(async () => {
      const res = await saveBoxesBulk(inputs);
      if (!res.ok && res.error) setError(res.error);
      else {
        setResult(res);
        setStep("done");
        onDone();
      }
    });
  };

  const stepIndex = { select: 0, fill: 1, review: 2, done: 3 }[step];
  const head = (
    <ScreenHead
      th="เพิ่มกล่องบรรจุหลายรายการ"
      en="Bulk add packed boxes"
      right={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <StepDots active={stepIndex} labels={STEPS} />
          <Btn kind="ghost" size="sm" icon="x" onClick={onClose}>ปิด</Btn>
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
            <select value={version} onChange={(e) => setVersion(e.target.value)} style={{ width: 240, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", fontSize: 14 }}>
              {finishes.map((f) => (
                <option key={f.id} value={f.id}>{f.th} · {f.en}</option>
              ))}
            </select>
          </Field>
          <Btn kind="soft" size="sm" icon="check" onClick={selectAllInVersion}>เลือกทั้งหมดในรุ่นนี้</Btn>
          {count > 0 && <span className="pill green tnum">เลือกแล้ว {count} รายการ</span>}
        </div>

        <Panel title={`เลือกล้อดิบที่จะแพ็ค — ${versionLabel(finishes, version)}`} en="1 ล้อดิบ = 1 กล่อง (50/กล่อง โดยปริยาย)">
          <div style={{ overflowX: "auto" }} className="scroll">
            <table style={{ borderCollapse: "separate", borderSpacing: 8 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 12, color: "var(--ink-3)", padding: "0 8px" }}>Size \\ Groove</th>
                  {grooves.map((g) => (
                    <th key={g.id} style={{ fontSize: 12.5, fontWeight: 700, padding: "0 8px", minWidth: 110 }}>{g.en}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sizes.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontSize: 13, fontWeight: 700, padding: "0 8px", whiteSpace: "nowrap" }}><span className="pill blue">{s.en}</span></td>
                    {grooves.map((g) => {
                      const r = rawByCombo.get(`${version}|${s.id}|${g.id}`);
                      const noRaw = !r;
                      const boxed = r ? boxedRawIds.has(r.id) : false;
                      const picked = r ? !!basket[r.id] : false;
                      const disabled = noRaw || boxed;
                      return (
                        <td key={g.id}>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => r && toggle(r)}
                            className="focusable"
                            style={{
                              width: "100%",
                              minWidth: 106,
                              height: 54,
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: disabled ? "default" : "pointer",
                              border: `1px solid ${picked ? "var(--accent)" : "var(--border-2)"}`,
                              background: disabled ? "var(--surface-3)" : picked ? "var(--accent-soft)" : "var(--surface)",
                              color: disabled ? "var(--ink-4)" : picked ? "var(--accent-ink)" : "var(--ink-2)",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 2,
                            }}
                          >
                            {noRaw ? (
                              <span style={{ fontSize: 10.5 }}>ไม่มีล้อดิบ</span>
                            ) : boxed ? (
                              <><Icon name="check" size={13} /><span style={{ fontSize: 10 }}>มีกล่องแล้ว</span></>
                            ) : picked ? (
                              <><Icon name="check" size={16} /><span style={{ fontSize: 10 }}>เลือก</span></>
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
          <Btn kind="ghost" onClick={onClose} disabled={pending}>ยกเลิก</Btn>
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
        <Panel title="กรอกข้อมูลแต่ละกล่อง" en="SKU แนะนำให้อัตโนมัติ · แก้ไขได้" pad={0}>
          <div style={{ overflowX: "auto" }} className="scroll">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["ล้อดิบที่บรรจุ", "SKU", "ต่อกล่อง", "ชื่อ/หมายเหตุ", "หน่วย", "ขั้นต่ำ", "ลำดับ", "ใช้งาน", ""].map((h, i) => (
                    <th key={i} style={{ textAlign: i === 2 || (i >= 5 && i <= 6) ? "right" : "left", padding: "8px 10px", fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderedRows.map((d) => (
                  <tr key={d.rawId} style={{ borderBottom: "1px solid var(--surface-3)" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>{d.rawLabel}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <input value={d.sku} onChange={(e) => patch(d.rawId, { sku: e.target.value, skuTouched: true })} style={{ width: 160, padding: "7px 9px", borderRadius: 8, fontSize: 12.5, border: `1px solid ${skuIssues[d.rawId] ? "var(--red)" : "var(--border-2)"}`, background: "var(--surface)" }} />
                      {skuIssues[d.rawId] && <div style={{ fontSize: 10.5, color: "var(--red-ink)", marginTop: 2 }}>{skuIssues[d.rawId]}</div>}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>
                      <input inputMode="numeric" value={d.units} onChange={(e) => setUnits(d.rawId, e.target.value)} placeholder="50" style={{ width: 60, padding: "7px 9px", borderRadius: 8, fontSize: 12.5, textAlign: "right", border: "1px solid var(--border-2)", background: "var(--surface)" }} />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <input value={d.name} onChange={(e) => patch(d.rawId, { name: e.target.value })} placeholder="(ถ้ามี)" style={{ width: 150, padding: "7px 9px", borderRadius: 8, fontSize: 12.5, border: "1px solid var(--border-2)", background: "var(--surface)" }} />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <input value={d.unit} onChange={(e) => patch(d.rawId, { unit: e.target.value })} style={{ width: 60, padding: "7px 9px", borderRadius: 8, fontSize: 12.5, border: "1px solid var(--border-2)", background: "var(--surface)" }} />
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>
                      <input inputMode="numeric" value={d.min} onChange={(e) => patch(d.rawId, { min: e.target.value.replace(/\D/g, "") })} placeholder="0" style={{ width: 54, padding: "7px 9px", borderRadius: 8, fontSize: 12.5, textAlign: "right", border: "1px solid var(--border-2)", background: "var(--surface)" }} />
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>
                      <input inputMode="numeric" value={d.order} onChange={(e) => patch(d.rawId, { order: e.target.value.replace(/\D/g, "") })} placeholder="0" style={{ width: 54, padding: "7px 9px", borderRadius: 8, fontSize: 12.5, textAlign: "right", border: "1px solid var(--border-2)", background: "var(--surface)" }} />
                    </td>
                    <td style={{ padding: "8px 10px" }}><Toggle on={d.active} onChange={(v) => patch(d.rawId, { active: v })} /></td>
                    <td style={{ padding: "8px 10px" }}>
                      <button onClick={() => removeRow(d.rawId)} title="เอาออก" style={{ border: "none", background: "var(--red-soft)", color: "var(--red-ink)", borderRadius: 8, width: 30, height: 30 }}>
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
          <Btn kind="default" icon="chevL" onClick={() => setStep("select")} disabled={pending}>กลับไปเลือก</Btn>
          <Btn kind="primary" size="lg" icon="chevR" disabled={count === 0 || hasIssues} style={{ opacity: count === 0 || hasIssues ? 0.5 : 1 }} onClick={() => setStep("review")}>
            ตรวจทาน ({count})
          </Btn>
        </div>
        {hasIssues && <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--red-ink)", fontWeight: 600 }}>มี SKU ซ้ำ/ว่าง หรือจำนวนต่อกล่องไม่ถูกต้อง — แก้ก่อนจึงจะไปต่อได้</div>}
      </div>
    );

  /* ---------- STEP: review ---------- */
  if (step === "review")
    return (
      <div className="fade-up">
        {head}
        <Panel title="ตรวจทานก่อนสร้าง" en={`${count} กล่อง · ยังไม่บันทึกจนกว่าจะยืนยัน`}>
          {orderedRows.map((d) => (
            <div key={d.rawId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 4px", borderBottom: "1px solid var(--surface-3)" }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)", width: 170 }}>{d.sku}</span>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{d.rawLabel}{d.name ? ` · ${d.name}` : ""}</span>
              <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700 }}>{d.units} {d.unit === "กล่อง" ? "/กล่อง" : `/${d.unit}`}</span>
              <span className={`pill ${d.active ? "green" : "grey"}`}>{d.active ? "ใช้งาน" : "ปิด"}</span>
            </div>
          ))}
        </Panel>
        {error && <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 16 }}>
          <Btn kind="default" icon="edit" onClick={() => setStep("fill")} disabled={pending}>แก้ไข</Btn>
          <Btn kind="primary" size="lg" icon="check" onClick={confirm} disabled={pending}>
            {pending ? "กำลังสร้าง…" : `ยืนยันสร้าง ${count} กล่อง`}
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
            <div style={{ fontSize: 18, fontWeight: 700 }}>สร้างกล่องบรรจุเรียบร้อย · {result?.created ?? 0} รายการ</div>
            {result?.skipped.length ? (
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>ข้าม {result.skipped.length}: {result.skipped.map((s) => `${s.sku} (${s.reason})`).join(", ")}</div>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>เพิ่มลงแคตตาล็อกแล้ว</div>
            )}
          </div>
          <Btn kind="default" icon="plus" onClick={() => { setBasket({}); setResult(null); setStep("select"); }}>เพิ่มชุดใหม่</Btn>
          <Btn kind="primary" onClick={onClose}>เสร็จสิ้น</Btn>
        </div>
      </Panel>
    </div>
  );
}
