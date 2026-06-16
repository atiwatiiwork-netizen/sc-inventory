"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Shortage, WheelLookup } from "@/lib/wheels/types";
import { groupByHierarchy } from "@/lib/wheels/grouping";
import { Icon } from "@/components/icon";
import { Btn } from "@/components/ui";
import { submitProduction } from "@/app/worker/(secure)/wheels/actions";

/** What consuming ONE output unit deducts (preview only; the RPC is authoritative). */
export type Deduction = { label: string; sku: string; perUnit: number; unit: string; tracked: boolean };
export type ProdOutput = {
  id: string;
  sku: string;
  label: string;
  unit: string;
  stock: number;
  deductions: Deduction[];
  // wheel coordinates (present for packing/boxes; absent for assembly)
  version?: string;
  size?: string;
  groove?: string;
};

type Step = "entry" | "review" | "done";

export function ProductionClient({
  kind,
  title,
  outputs,
  existing,
  today,
  finishes = [],
  sizes = [],
  grooves = [],
}: {
  kind: "pack" | "assemble";
  title: string;
  outputs: ProdOutput[];
  existing: Record<string, number>;
  today: string;
  finishes?: WheelLookup[];
  sizes?: WheelLookup[];
  grooves?: WheelLookup[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("entry");
  const [qty, setQty] = useState<Record<string, number>>(existing);
  const [shortages, setShortages] = useState<Shortage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const setOne = (id: string, v: string) =>
    setQty((q) => {
      const n = { ...q };
      const num = Number(v.replace(/\D/g, "").slice(0, 6)) || 0;
      if (num) n[id] = num;
      else delete n[id];
      return n;
    });

  const chosen = outputs.filter((o) => qty[o.id]);
  const totalOut = chosen.reduce((s, o) => s + (qty[o.id] || 0), 0);

  // Aggregate the auto-deductions across all chosen outputs (preview).
  const deductPreview = useMemo(() => {
    const m = new Map<string, { label: string; sku: string; amt: number; unit: string; tracked: boolean }>();
    for (const o of chosen) {
      const n = qty[o.id] || 0;
      for (const d of o.deductions) {
        const key = `${d.sku}|${d.label}`;
        const cur = m.get(key) ?? { label: d.label, sku: d.sku, amt: 0, unit: d.unit, tracked: d.tracked };
        cur.amt += n * d.perUnit;
        m.set(key, cur);
      }
    }
    return [...m.values()];
  }, [chosen, qty]);

  const reset = () => {
    setStep("entry");
    setQty({});
    setShortages(null);
    setError(null);
  };

  const commit = () => {
    setError(null);
    const items = Object.entries(qty).map(([ref_id, q]) => ({ ref_id, qty: q }));
    start(async () => {
      const res = await submitProduction({ date: today, kind, noProduction: false, items });
      if (res.ok) {
        setStep("done");
        router.refresh();
      } else if (res.shortages && res.shortages.length) {
        setShortages(res.shortages);
      } else {
        setError(res.error || "บันทึกไม่สำเร็จ");
      }
    });
  };

  if (step === "done")
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "28px 18px" }}>
        <div className="card" style={{ padding: 22, display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ width: 56, height: 56, borderRadius: 99, background: "var(--green)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", animation: "checkPop .45s cubic-bezier(.2,.8,.2,1) both" }}>
            <Icon name="check" size={30} stroke={2.6} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>บันทึกการผลิตเรียบร้อย</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>สต็อกอัปเดตแล้ว · ระบบหักวัตถุดิบให้อัตโนมัติ</div>
          </div>
        </div>
        <Btn kind="primary" full icon="edit" style={{ marginTop: 14 }} onClick={reset}>
          บันทึกเพิ่ม / แก้ไข
        </Btn>
      </div>
    );

  if (step === "review")
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 18px 32px" }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>ตรวจทาน · {title}</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 16 }}>ระบบจะหักวัตถุดิบให้อัตโนมัติ — ยังไม่บันทึกจนกว่าจะยืนยัน</div>

        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>ผลิตเสร็จ (เพิ่มสต็อก)</div>
          {chosen.map((o) => (
            <div key={o.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--surface-3)" }}>
              <span style={{ fontSize: 13.5 }}>{o.label} <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{o.sku}</span></span>
              <span className="tnum" style={{ fontWeight: 700, color: "var(--green-ink)" }}>+{qty[o.id]} {o.unit}</span>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>หักวัตถุดิบอัตโนมัติ (ระบบคำนวณ)</div>
          {deductPreview.length === 0 && <div style={{ fontSize: 13, color: "var(--ink-4)" }}>—</div>}
          {deductPreview.map((d) => (
            <div key={d.sku + d.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--surface-3)" }}>
              <span style={{ fontSize: 13.5 }}>
                {d.label} <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{d.sku}</span>
                {!d.tracked && <span style={{ fontSize: 11, color: "var(--ink-4)" }}> · ไม่ติดตามสต็อก</span>}
              </span>
              {d.tracked && <span className="tnum" style={{ fontWeight: 700, color: "var(--red-ink)" }}>−{d.amt} {d.unit}</span>}
            </div>
          ))}
        </div>

        {shortages && (
          <div style={{ marginBottom: 14, padding: "14px 16px", borderRadius: 12, background: "var(--red-soft)", color: "var(--red-ink)" }}>
            <div style={{ fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="alert" size={17} /> วัตถุดิบไม่พอ — บันทึกไม่ได้
            </div>
            {shortages.map((s) => (
              <div key={`${s.layer}-${s.ref_id}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>{s.sku}</span>
                <span className="tnum">ต้องการ {s.need} · มี {s.have} · ขาด {s.short}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, fontSize: 12.5 }}>แจ้งออฟฟิศ/ผู้ดูแลให้บันทึกการรับเข้าก่อน หรือปรับจำนวน</div>
          </div>
        )}
        {error && (
          <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <Btn kind="default" size="lg" icon="chevL" onClick={() => { setStep("entry"); setShortages(null); }} disabled={pending} style={{ flex: "0 0 130px" }}>
            แก้ไข
          </Btn>
          <Btn kind="primary" size="lg" icon="check" onClick={commit} disabled={pending} style={{ flex: 1 }}>
            {pending ? "กำลังบันทึก…" : "ยืนยันและบันทึก"}
          </Btn>
        </div>
      </div>
    );

  // entry
  const renderRow = (o: ProdOutput) => (
    <div key={o.id} className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{o.label}</div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
          {o.sku} · คงเหลือ {o.stock} {o.unit}
        </div>
        {o.deductions.length > 0 && (
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 3 }}>
            ใช้: {o.deductions.map((d) => `${d.label} ${d.perUnit}${d.unit}`).join(" · ")}
          </div>
        )}
      </div>
      <input
        className="tnum focusable"
        inputMode="numeric"
        value={qty[o.id] ?? ""}
        placeholder="0"
        onChange={(e) => setOne(o.id, e.target.value)}
        style={{
          width: 80,
          height: 52,
          textAlign: "center",
          fontSize: 20,
          fontWeight: 700,
          borderRadius: 12,
          border: "1px solid var(--border-2)",
          background: qty[o.id] ? "var(--accent-soft)" : "var(--surface-2)",
          color: qty[o.id] ? "var(--accent-ink)" : "var(--ink-4)",
          flex: "none",
        }}
      />
    </div>
  );
  const grouped = outputs.some((o) => o.version);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 18px 32px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 16 }}>
        วันที่ <span className="mono">{today}</span> · กรอกจำนวนที่ผลิตเสร็จ
      </div>

      {outputs.length === 0 ? (
        <div className="card" style={{ padding: 18, color: "var(--ink-3)", fontSize: 14 }}>
          ยังไม่มีรายการให้บันทึก — ให้ผู้ดูแลตั้งค่าแคตตาล็อกก่อน
        </div>
      ) : grouped ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {groupByHierarchy(outputs, (o) => ({ version: o.version ?? "", size: o.size ?? "", groove: o.groove ?? "" }), finishes, sizes, grooves).map((v) => (
            <div key={v.versionId}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{v.versionLabel}</div>
              {v.sizes.map((sg) => (
                <div key={sg.sizeId} style={{ marginBottom: 8 }}>
                  <div style={{ marginBottom: 6 }}>
                    <span className="pill blue">{sg.sizeLabel}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{sg.items.map(renderRow)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{outputs.map(renderRow)}</div>
      )}

      <div style={{ position: "sticky", bottom: 0, marginTop: 18, paddingTop: 12, background: "linear-gradient(transparent, var(--bg) 30%)" }}>
        <Btn
          kind="primary"
          size="lg"
          full
          icon="chevR"
          disabled={totalOut === 0}
          style={{ opacity: totalOut === 0 ? 0.5 : 1 }}
          onClick={() => totalOut > 0 && setStep("review")}
        >
          ตรวจทาน ({totalOut} {chosen[0]?.unit ?? ""})
        </Btn>
      </div>
    </div>
  );
}
