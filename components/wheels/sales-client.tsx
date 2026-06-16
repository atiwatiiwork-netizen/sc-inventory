"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InventoryLayer, Shortage } from "@/lib/wheels/types";
import { Icon } from "@/components/icon";
import { Btn, Field, Panel, ScreenHead, TextInput } from "@/components/ui";
import { recordSale, type SaleLine } from "@/app/admin/(console)/wheels/sales/actions";

export type Sellable = { layer: InventoryLayer; id: string; sku: string; label: string; unit: string; stock: number };

const LAYER_TH: Record<InventoryLayer, string> = { raw: "ล้อดิบ", box: "กล่องบรรจุ", assembly: "สินค้าประกอบ" };

export function SalesClient({
  mode,
  sellables,
  isAdmin,
  today,
}: {
  mode: "standard" | "raw";
  sellables: Sellable[];
  isAdmin: boolean;
  today: string;
}) {
  const router = useRouter();
  const isRaw = mode === "raw";
  const [date, setDate] = useState(today);
  const [customer, setCustomer] = useState("");
  const [note, setNote] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [shortages, setShortages] = useState<Shortage[] | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const byId = useMemo(() => new Map(sellables.map((s) => [s.id, s])), [sellables]);
  const groups = useMemo(() => {
    const m = new Map<InventoryLayer, Sellable[]>();
    for (const s of sellables) (m.get(s.layer) ?? m.set(s.layer, []).get(s.layer)!).push(s);
    return [...m.entries()];
  }, [sellables]);

  const setOne = (id: string, v: string) =>
    setQty((q) => {
      const n = { ...q };
      const num = Number(v.replace(/\D/g, "").slice(0, 7)) || 0;
      if (num) n[id] = num;
      else delete n[id];
      return n;
    });

  const lines: SaleLine[] = Object.entries(qty).map(([ref_id, q]) => ({ layer: byId.get(ref_id)!.layer, ref_id, qty: q }));
  const filled = lines.length;
  const dirty = filled > 0;

  const reset = () => {
    setQty({});
    setCustomer("");
    setNote("");
    setShortages(null);
    setReason("");
    setError(null);
  };

  const submit = (override: boolean) => {
    setError(null);
    if (override && !reason.trim()) {
      setError("กรุณาระบุเหตุผลในการข้ามคำเตือน");
      return;
    }
    start(async () => {
      const res = await recordSale({ date, customer, note, lines, allowRaw: isRaw, override, reason });
      if (res.ok) {
        setDoneMsg(`บันทึกการขายเรียบร้อย · ${filled} รายการ`);
        reset();
        router.refresh();
      } else if (res.shortages && res.shortages.length) {
        setShortages(res.shortages);
      } else {
        setError(res.error || "บันทึกไม่สำเร็จ");
      }
    });
  };

  return (
    <div className="fade-up">
      <ScreenHead
        th={isRaw ? "ขายล้อดิบ (พิเศษ)" : "บันทึกการขาย"}
        en={isRaw ? "Raw-Wheel Sale · admin exception" : "Sales · packed boxes & assemblies"}
      />

      {isRaw && (
        <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: "var(--amber-soft, var(--surface-2))", color: "var(--ink-2)", fontSize: 13, lineHeight: 1.5 }}>
          รายการนี้สำหรับการขายล้อดิบโดยตรงซึ่งเป็นกรณีพิเศษ (ประมาณ 5%) — ปกติล้อดิบจะถูกใช้ภายในโดยการแพ็คหรือการประกอบ
        </div>
      )}

      {doneMsg && (
        <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: "var(--green-soft, var(--accent-soft))", color: "var(--green-ink, var(--accent-ink))", fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="check" size={17} /> {doneMsg}
        </div>
      )}

      <div style={{ maxWidth: 820 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <Field label="วันที่ขาย" en="Sale date">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="ลูกค้า (ถ้ามี)" en="Customer · optional">
            <TextInput value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="เว้นว่างได้" />
          </Field>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {groups.map(([layer, items]) => (
            <Panel key={layer} title={LAYER_TH[layer]} en={`${items.length} SKU`}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 }}>
                {items.map((s) => (
                  <div key={s.id}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 5 }}>
                      {s.label}
                      <div className="mono" style={{ fontSize: 10, color: "var(--ink-4)", fontWeight: 400 }}>
                        {s.sku} · คงเหลือ {s.stock} {s.unit}
                      </div>
                    </div>
                    <input
                      className="tnum focusable"
                      inputMode="numeric"
                      value={qty[s.id] ?? ""}
                      placeholder="0"
                      onChange={(e) => {
                        setOne(s.id, e.target.value);
                        setShortages(null);
                      }}
                      style={{
                        width: "100%",
                        height: 52,
                        textAlign: "center",
                        fontSize: 20,
                        fontWeight: 700,
                        borderRadius: 12,
                        border: "1px solid var(--border-2)",
                        background: qty[s.id] ? "var(--accent-soft)" : "var(--surface-2)",
                        color: qty[s.id] ? "var(--accent-ink)" : "var(--ink-4)",
                      }}
                    />
                  </div>
                ))}
                {items.length === 0 && <div style={{ color: "var(--ink-4)", fontSize: 13 }}>ไม่มีรายการ</div>}
              </div>
            </Panel>
          ))}
        </div>

        <Field label="หมายเหตุ (ถ้ามี)" en="Notes · optional">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น เลขที่ใบสั่งขาย" />
        </Field>

        {/* shortage soft-block */}
        {shortages && (
          <div style={{ margin: "4px 0 14px", padding: "14px 16px", borderRadius: 12, background: "var(--red-soft)", color: "var(--red-ink)" }}>
            <div style={{ fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="alert" size={17} /> สต็อกไม่พอ — ไม่สามารถบันทึกได้
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              {shortages.map((s) => (
                <div key={`${s.layer}-${s.ref_id}`} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{LAYER_TH[s.layer]} · {s.sku}</span>
                  <span className="tnum">ต้องการ {s.need} · มี {s.have} · ขาด {s.short}</span>
                </div>
              ))}
            </div>
            {isAdmin ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>ผู้ดูแลสามารถข้ามคำเตือนได้ (ต้องระบุเหตุผล)</div>
                <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผล เช่น ของมีจริงแต่ยังบันทึกการผลิตไม่ทัน" style={{ marginBottom: 10 }} />
                <Btn kind="danger" icon="check" onClick={() => submit(true)} disabled={pending}>
                  {pending ? "กำลังบันทึก…" : "ข้ามคำเตือนและบันทึก (override)"}
                </Btn>
              </div>
            ) : (
              <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 500 }}>
                ติดต่อผู้ดูแลเพื่อขออนุมัติ หรือบันทึกการผลิต/รับเข้าให้ครบก่อน
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <Btn kind="primary" size="lg" icon="check" full disabled={!dirty || pending} style={{ opacity: !dirty ? 0.5 : 1 }} onClick={() => submit(false)}>
          {pending ? "กำลังบันทึก…" : `ยืนยันการขาย (${filled} รายการ)`}
        </Btn>
      </div>
    </div>
  );
}
