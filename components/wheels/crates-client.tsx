"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Btn, DataTable, Field, Modal, Panel, ScreenHead, SelectInput, TextInput, Toggle } from "@/components/ui";
import { saveCrate, adjustCrate, deleteCrate, type CrateInput } from "@/app/admin/(console)/wheels/crates/actions";

export type CrateRow = {
  id: string;
  raw_id: string;
  name: string;
  sku: string;
  pieces_per_crate: number;
  crate_qty: number;
  note: string | null;
  active: boolean;
};
export type CrateMoveRow = {
  id: string;
  name: string;
  delta: number;
  before_qty: number;
  after_qty: number;
  note: string | null;
  by: string | null;
  at: string;
};
type AvailableRaw = { id: string; sku: string; name: string; unit: string };

const fmtAt = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

export function CratesClient({ rows, available, history }: { rows: CrateRow[]; available: AvailableRaw[]; history: CrateMoveRow[] }) {
  const [editing, setEditing] = useState<CrateRow | "new" | null>(null);
  const [adjusting, setAdjusting] = useState<CrateRow | null>(null);
  const router = useRouter();

  const totalCrates = rows.reduce((s, r) => s + r.crate_qty, 0);
  const totalPieces = rows.reduce((s, r) => s + r.crate_qty * r.pieces_per_crate, 0);

  return (
    <div className="fade-up">
      <ScreenHead
        th="ลังไม้ (สต็อก)"
        en="Wooden Crate Inventory · ดูอย่างเดียว"
        right={
          available.length > 0 ? (
            <Btn kind="primary" icon="plus" size="sm" onClick={() => setEditing("new")}>
              เพิ่มลังไม้
            </Btn>
          ) : undefined
        }
      />
      <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 16 }}>
        จำนวนลังไม้จากจีน (ลังละ ~2000–2400 ลูก) ที่มีอยู่ · บันทึกด้วยมือ · ไม่เชื่อมกับการตัดสต็อก/การผลิต
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Mini label="ลังทั้งหมด" en="Total crates" value={`${totalCrates.toLocaleString()} ลัง`} />
        <Mini label="ประมาณ (ลูก)" en="≈ wheels" value={`~${totalPieces.toLocaleString()} ลูก`} />
      </div>

      <Panel pad={0} style={{ marginBottom: 18 }}>
        <DataTable
          cols={[
            { label: "ล้อดิบ" },
            { label: "ชิ้น/ลัง", right: true, w: 90 },
            { label: "ลังคงเหลือ", right: true, w: 100 },
            { label: "≈ ลูก", right: true, w: 110 },
            { label: "สถานะ", w: 80 },
            { label: "", w: 150 },
          ]}
        >
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid var(--surface-3)", opacity: r.active ? 1 : 0.55 }}>
              <td style={{ padding: "11px 14px" }}>
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{r.sku}{r.note ? ` · ${r.note}` : ""}</div>
              </td>
              <td className="tnum" style={{ padding: "11px 14px", textAlign: "right" }}>{r.pieces_per_crate.toLocaleString()}</td>
              <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700 }}>{r.crate_qty.toLocaleString()}</td>
              <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", color: "var(--ink-3)" }}>
                ~{(r.crate_qty * r.pieces_per_crate).toLocaleString()}
              </td>
              <td style={{ padding: "11px 14px" }}>
                <span className={`pill ${r.active ? "green" : "grey"}`}>{r.active ? "ใช้งาน" : "ปิด"}</span>
              </td>
              <td style={{ padding: "11px 14px" }}>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <Btn kind="soft" size="sm" icon="sliders" onClick={() => setAdjusting(r)}>ปรับยอด</Btn>
                  <button
                    onClick={() => setEditing(r)}
                    style={{ border: "none", background: "var(--surface-3)", borderRadius: 8, width: 32, height: 32, color: "var(--ink-2)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <Icon name="edit" size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 28, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>
                ยังไม่มีบันทึกลังไม้
              </td>
            </tr>
          )}
        </DataTable>
      </Panel>

      <Panel title="ประวัติการปรับยอด" en="Adjustment history" pad={0}>
        {history.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--ink-4)", fontSize: 13.5 }}>ยังไม่มีประวัติ</div>
        ) : (
          history.map((h, i) => (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i === history.length - 1 ? "none" : "1px solid var(--surface-3)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{h.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 1 }}>
                  {fmtAt(h.at)}{h.by ? ` · ${h.by}` : ""}{h.note ? ` · ${h.note}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                <span className="tnum" style={{ fontWeight: 700, color: h.delta >= 0 ? "var(--green-ink)" : "var(--red-ink)" }}>
                  {h.delta >= 0 ? "+" : ""}{h.delta.toLocaleString()}
                </span>
                <div className="tnum" style={{ fontSize: 11, color: "var(--ink-4)" }}>{h.before_qty} → {h.after_qty}</div>
              </div>
            </div>
          ))
        )}
      </Panel>

      {editing && (
        <CrateModal
          editing={editing}
          available={available}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      {adjusting && (
        <AdjustModal
          crate={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Mini({ label, en, value }: { label: string; en: string; value: string }) {
  return (
    <div className="card" style={{ padding: "12px 16px", minWidth: 150 }}>
      <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>{label} <span className="en" style={{ fontSize: 10.5 }}>{en}</span></div>
      <div className="tnum" style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function CrateModal({ editing, available, onClose, onSaved }: { editing: CrateRow | "new"; available: AvailableRaw[]; onClose: () => void; onSaved: () => void }) {
  const isNew = editing === "new";
  const c = isNew ? null : editing;
  const [rawId, setRawId] = useState(c?.raw_id ?? available[0]?.id ?? "");
  const [pieces, setPieces] = useState(String(c?.pieces_per_crate ?? "2000"));
  const [qty, setQty] = useState(String(c?.crate_qty ?? ""));
  const [note, setNote] = useState(c?.note ?? "");
  const [active, setActive] = useState(isNew ? true : c!.active);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setError(null);
    const input: CrateInput = {
      id: isNew ? undefined : c!.id,
      raw_id: rawId,
      pieces_per_crate: Number(pieces) || 0,
      crate_qty: Number(qty) || 0,
      note,
      active,
    };
    start(async () => {
      const res = await saveCrate(input);
      if (res.ok) onSaved();
      else setError(res.error || "บันทึกไม่สำเร็จ");
    });
  };

  const remove = () => {
    if (isNew) return;
    setError(null);
    start(async () => {
      const res = await deleteCrate(c!.id);
      if (res.ok) onSaved();
      else setError(res.error || "ลบไม่สำเร็จ");
    });
  };

  return (
    <Modal
      title={isNew ? "เพิ่มลังไม้" : "แก้ไขลังไม้"}
      en={isNew ? "New crate record" : c!.sku}
      onClose={onClose}
      width={480}
      footer={
        <>
          {!isNew && (
            <Btn kind="danger" icon="trash" onClick={remove} disabled={pending} style={{ marginRight: "auto" }}>ลบ</Btn>
          )}
          <Btn kind="ghost" onClick={onClose} disabled={pending}>ยกเลิก</Btn>
          <Btn kind="primary" icon="check" onClick={save} disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึก"}</Btn>
        </>
      }
    >
      {isNew ? (
        <Field label="ล้อดิบ" en="Raw wheel">
          <SelectInput value={rawId} onChange={(e) => setRawId(e.target.value)}>
            {available.map((r) => (
              <option key={r.id} value={r.id}>{r.name} · {r.sku}</option>
            ))}
          </SelectInput>
        </Field>
      ) : (
        <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)", fontSize: 13.5, fontWeight: 600 }}>
          {c!.name} <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{c!.sku}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="ชิ้นต่อลัง" en="Pieces per crate">
          <TextInput inputMode="numeric" value={pieces} onChange={(e) => setPieces(e.target.value.replace(/\D/g, ""))} placeholder="2000" />
        </Field>
        {isNew && (
          <Field label="จำนวนลังเริ่มต้น" en="Initial crates">
            <TextInput inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder="0" />
          </Field>
        )}
      </div>

      <Field label="หมายเหตุ (ถ้ามี)" en="Note · optional">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ล็อตนำเข้าเดือนนี้" />
      </Field>

      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", marginTop: 4 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>เปิดใช้งาน <span className="en">Active</span></span>
        <Toggle on={active} onChange={setActive} />
      </label>
      {!isNew && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-4)" }}>* แก้จำนวนลังคงเหลือได้ที่ปุ่ม “ปรับยอด” (เก็บประวัติ)</div>
      )}

      {error && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>{error}</div>
      )}
    </Modal>
  );
}

function AdjustModal({ crate, onClose, onSaved }: { crate: CrateRow; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<"set" | "delta">("delta");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // For delta mode allow a sign; for set mode digits only.
  const onValue = (v: string) => setValue(mode === "delta" ? v.replace(/[^\d-]/g, "") : v.replace(/\D/g, ""));

  const preview = mode === "set" ? Math.max(0, Number(value) || 0) : Math.max(0, crate.crate_qty + (Number(value) || 0));

  const save = () => {
    setError(null);
    start(async () => {
      const res = await adjustCrate(crate.id, mode, Number(value) || 0, note);
      if (res.ok) onSaved();
      else setError(res.error || "ปรับยอดไม่สำเร็จ");
    });
  };

  return (
    <Modal
      title="ปรับยอดลัง"
      en={crate.sku}
      onClose={onClose}
      width={440}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose} disabled={pending}>ยกเลิก</Btn>
          <Btn kind="primary" icon="check" onClick={save} disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึก"}</Btn>
        </>
      }
    >
      <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)", fontSize: 13.5 }}>
        {crate.name} · คงเหลือปัจจุบัน <span className="tnum" style={{ fontWeight: 700 }}>{crate.crate_qty.toLocaleString()}</span> ลัง
      </div>

      <Field label="วิธีปรับ" en="Mode">
        <SelectInput value={mode} onChange={(e) => { setMode(e.target.value as "set" | "delta"); setValue(""); }}>
          <option value="delta">เพิ่ม/ลด (+/−)</option>
          <option value="set">ตั้งค่าเป็น (set)</option>
        </SelectInput>
      </Field>

      <Field label={mode === "delta" ? "จำนวนที่เปลี่ยน (เช่น 5 หรือ -3)" : "จำนวนลังใหม่"} en="Quantity">
        <TextInput inputMode={mode === "delta" ? "text" : "numeric"} value={value} onChange={(e) => onValue(e.target.value)} placeholder={mode === "delta" ? "+5 / -3" : "10"} />
      </Field>

      <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 12 }}>
        ผลลัพธ์: <span className="tnum" style={{ fontWeight: 700, color: "var(--ink)" }}>{crate.crate_qty.toLocaleString()} → {preview.toLocaleString()}</span> ลัง
      </div>

      <Field label="หมายเหตุ (ถ้ามี)" en="Note · optional">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น นับสต็อกใหม่ / รับเข้าล็อตใหม่" />
      </Field>

      {error && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>{error}</div>
      )}
    </Modal>
  );
}
