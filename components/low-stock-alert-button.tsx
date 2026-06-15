"use client";

import { useState, useTransition } from "react";
import { Btn, Modal } from "@/components/ui";
import { Icon } from "@/components/icon";
import { sendLowStockAlerts } from "@/app/admin/(console)/low-stock/actions";

export type AlertCategory = { id: string; name: string; redCount: number; amberCount: number };

export function LowStockAlertButton({ categories }: { categories: AlertCategory[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const hasItems = categories.length > 0;

  const openModal = () => {
    setSelected(new Set(categories.map((c) => c.id))); // default: all preselected
    setError(null);
    setDone(null);
    setOpen(true);
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allOn = selected.size === categories.length && categories.length > 0;
  const toggleAll = () =>
    setSelected(allOn ? new Set() : new Set(categories.map((c) => c.id)));

  const send = () => {
    setError(null);
    setDone(null);
    start(async () => {
      const res = await sendLowStockAlerts([...selected]);
      if (res.ok) setDone(res.sent ?? 0);
      else setError(res.error || "ส่งไม่สำเร็จ");
    });
  };

  return (
    <>
      <Btn kind="default" icon="chat" size="sm" onClick={openModal} disabled={!hasItems}>
        ส่งแจ้งเตือน LINE
      </Btn>

      {open && (
        <Modal
          title="ส่งแจ้งเตือนสต็อกต่ำทาง LINE"
          en="Pick categories · one message each"
          onClose={() => setOpen(false)}
          width={460}
          footer={
            <>
              <Btn kind="ghost" onClick={() => setOpen(false)} disabled={pending}>
                {done != null ? "ปิด" : "ยกเลิก"}
              </Btn>
              <Btn kind="primary" icon="chat" onClick={send} disabled={pending || selected.size === 0}>
                {pending ? "กำลังส่ง…" : `ส่ง ${selected.size} หมวด`}
              </Btn>
            </>
          }
        >
          <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 12, lineHeight: 1.5 }}>
            แต่ละหมวดที่เลือกจะถูกส่งเป็นข้อความแยกกัน 1 ข้อความ (รวมเฉพาะรายการที่สต็อกต่ำในหมวดนั้น)
          </div>

          <button
            onClick={toggleAll}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--accent)",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              padding: "0 0 8px",
            }}
          >
            {allOn ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
          </button>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {categories.map((c) => {
              const on = selected.has(c.id);
              return (
                <label
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 13px",
                    borderRadius: 10,
                    border: `1px solid ${on ? "var(--accent)" : "var(--surface-3)"}`,
                    background: on ? "var(--accent-soft, var(--surface-2))" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(c.id)}
                    style={{ width: 17, height: 17, accentColor: "var(--accent)" }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 13.5, flex: 1 }}>{c.name}</span>
                  <span style={{ display: "flex", gap: 6 }}>
                    {c.redCount > 0 && <span className="pill red">{c.redCount} ต่ำกว่าขั้นต่ำ</span>}
                    {c.amberCount > 0 && <span className="pill amber">{c.amberCount} ใกล้หมด</span>}
                  </span>
                </label>
              );
            })}
          </div>

          {error && (
            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}
          {done != null && (
            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--green-soft, var(--surface-2))", color: "var(--green-ink, var(--ink))", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
              <Icon name="check" size={15} /> ส่งสำเร็จ {done} ข้อความ
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
