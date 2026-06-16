"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { rawWheelLabel } from "@/lib/wheels/sku";
import { Icon } from "@/components/icon";
import { Btn, Field, Panel, ScreenHead, TextInput } from "@/components/ui";
import { StepDots, KV } from "@/components/flow-bits";
import { receiveRaw } from "@/app/admin/(console)/wheels/receiving/actions";

type Step = "entry" | "review" | "done";
const STEPS = ["กรอกจำนวน", "ตรวจทาน", "เสร็จ"];

export function ReceivingClient({
  raw,
  finishes,
  sizes,
  grooves,
  today,
}: {
  raw: WheelRaw[];
  finishes: WheelLookup[];
  sizes: WheelLookup[];
  grooves: WheelLookup[];
  today: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("entry");
  const [date, setDate] = useState(today);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const label = (r: WheelRaw) => rawWheelLabel(r, finishes, sizes, grooves);

  // group raw wheels by finish for a tidy entry grid
  const groups = useMemo(() => {
    const m = new Map<string, { label: string; items: WheelRaw[] }>();
    for (const r of raw) {
      const f = finishes.find((x) => x.id === r.finish);
      const key = r.finish;
      const g = m.get(key) ?? { label: f ? `${f.th} · ${f.en}` : r.finish, items: [] };
      g.items.push(r);
      m.set(key, g);
    }
    return [...m.values()];
  }, [raw, finishes]);

  const setOne = (id: string, v: string) =>
    setQty((q) => {
      const n = { ...q };
      const num = Number(v.replace(/\D/g, "").slice(0, 6)) || 0;
      if (num) n[id] = num;
      else delete n[id];
      return n;
    });

  const grand = Object.values(qty).reduce((a, b) => a + b, 0);
  const filled = Object.keys(qty).length;

  const restart = () => {
    setStep("entry");
    setQty({});
    setNote("");
    setError(null);
  };

  const commit = () => {
    setError(null);
    const lines = Object.entries(qty).map(([raw_id, q]) => ({ raw_id, qty: q }));
    start(async () => {
      const res = await receiveRaw({ date, note, lines });
      if (res.ok) {
        setSavedCount(res.count ?? filled);
        setStep("done");
        router.refresh();
      } else setError(res.error || "บันทึกไม่สำเร็จ");
    });
  };

  if (raw.length === 0)
    return (
      <div className="fade-up">
        <ScreenHead th="รับล้อดิบเข้า" en="Raw Receiving" />
        <Panel>
          <div style={{ padding: 12, color: "var(--ink-3)", fontSize: 14 }}>
            ยังไม่มีล้อดิบในระบบ — เพิ่มที่เมนู “ล้อดิบ” ก่อน จึงจะรับเข้าได้
          </div>
        </Panel>
      </div>
    );

  if (step === "entry")
    return (
      <div className="fade-up">
        <ScreenHead th="รับล้อดิบเข้า" en="Raw Receiving · from supplier" right={<StepDots active={0} labels={STEPS} />} />
        <div style={{ maxWidth: 820 }}>
          <div style={{ marginBottom: 14 }}>
            <Field label="วันที่รับเข้า" en="Receiving date">
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 200 }} />
            </Field>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {groups.map((g) => {
              const gt = g.items.reduce((s, r) => s + (qty[r.id] || 0), 0);
              return (
                <Panel
                  key={g.label}
                  title={g.label}
                  en="กรอกจำนวนที่รับเข้า (ลูก)"
                  right={gt > 0 ? <span className="pill green tnum">+{gt}</span> : <span className="en" style={{ fontSize: 12 }}>{g.items.length} SKU</span>}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                    {g.items.map((r) => (
                      <div key={r.id}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 5 }}>
                          {sizes.find((s) => s.id === r.size)?.en ?? r.size} · {grooves.find((x) => x.id === r.groove)?.th ?? r.groove}
                          <div className="mono" style={{ fontSize: 10, color: "var(--ink-4)", fontWeight: 400 }}>
                            {r.sku} · คงเหลือ {r.stock}
                          </div>
                        </div>
                        <input
                          className="tnum focusable"
                          inputMode="numeric"
                          value={qty[r.id] ?? ""}
                          placeholder="0"
                          onChange={(e) => setOne(r.id, e.target.value)}
                          style={{
                            width: "100%",
                            height: 52,
                            textAlign: "center",
                            fontSize: 20,
                            fontWeight: 700,
                            borderRadius: 12,
                            border: "1px solid var(--border-2)",
                            background: qty[r.id] ? "var(--accent-soft)" : "var(--surface-2)",
                            color: qty[r.id] ? "var(--accent-ink)" : "var(--ink-4)",
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
            <div style={{ fontSize: 13.5, color: "var(--ink-2)" }}>ช่องว่าง = 0 อัตโนมัติ</div>
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

  if (step === "review")
    return (
      <div className="fade-up">
        <ScreenHead th="ตรวจทานการรับเข้า" en="Review before saving" right={<StepDots active={1} labels={STEPS} />} />
        <div style={{ maxWidth: 720 }}>
          <Panel title="สรุปการรับล้อดิบ" en="Nothing is saved until you confirm" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 28, marginBottom: 16 }}>
              <KV k="วันที่" en="Date" v={<span className="mono">{date}</span>} />
              <KV k="จำนวน SKU" en="Line items" v={`${filled} รายการ`} />
            </div>
            {raw
              .filter((r) => qty[r.id])
              .map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: "1px solid var(--surface-3)" }}>
                  <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)", width: 140 }}>{r.sku}</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{label(r)}</span>
                  <span className="tnum" style={{ fontSize: 16, fontWeight: 700, color: "var(--green-ink)" }}>+{qty[r.id]} {r.unit}</span>
                </div>
              ))}
            <div style={{ marginTop: 14 }}>
              <Field label="หมายเหตุ (ถ้ามี)" en="Notes · optional">
                <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น เลขที่ใบส่งของ / ซัพพลายเออร์" />
              </Field>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderRadius: 12, background: "var(--accent-soft)", marginTop: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-ink)" }}>รวมรับเข้าทั้งหมด</span>
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
              แก้ไข
            </Btn>
            <Btn kind="primary" size="lg" icon="check" onClick={commit} disabled={pending} style={{ flex: 1 }}>
              {pending ? "กำลังบันทึก…" : "ยืนยันและบันทึก"}
            </Btn>
          </div>
        </div>
      </div>
    );

  return (
    <div className="fade-up">
      <ScreenHead th="รับล้อดิบเข้า" en="Raw Receiving" right={<StepDots active={2} labels={STEPS} />} />
      <div style={{ maxWidth: 720 }}>
        <Panel>
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "6px 2px" }}>
            <span style={{ width: 56, height: 56, borderRadius: 99, background: "var(--green)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", animation: "checkPop .45s cubic-bezier(.2,.8,.2,1) both" }}>
              <Icon name="check" size={30} stroke={2.6} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 19, fontWeight: 700 }}>รับล้อดิบเข้าเรียบร้อย</div>
              <div style={{ fontSize: 13.5, color: "var(--ink-3)" }}>สต็อกล้อดิบเพิ่มแล้ว · {savedCount} รายการ</div>
            </div>
            <Btn kind="primary" icon="plus" onClick={restart}>รับเข้ารายการใหม่</Btn>
          </div>
        </Panel>
      </div>
    </div>
  );
}
