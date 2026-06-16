"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WheelLookup } from "@/lib/wheels/types";
import { Icon } from "@/components/icon";
import { Btn, DataTable, Field, Modal, Panel, ScreenHead, TextInput } from "@/components/ui";
import { saveAttr, deleteAttr, type AttrKind } from "@/app/admin/(console)/wheels/attributes/actions";
import { slugify } from "@/lib/wheels/sku";

const KIND_TH: Record<AttrKind, string> = { version: "รุ่น/เวอร์ชัน", size: "ขนาด", groove: "ร่อง" };
const KIND_EN: Record<AttrKind, string> = { version: "Versions", size: "Sizes", groove: "Grooves" };

type Editing = { kind: AttrKind; row: WheelLookup | "new" } | null;

export function AttributesClient({
  versions,
  sizes,
  grooves,
}: {
  versions: WheelLookup[];
  sizes: WheelLookup[];
  grooves: WheelLookup[];
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const router = useRouter();

  const sections: { kind: AttrKind; rows: WheelLookup[] }[] = [
    { kind: "version", rows: versions },
    { kind: "size", rows: sizes },
    { kind: "groove", rows: grooves },
  ];

  return (
    <div className="fade-up">
      <ScreenHead
        th="ตั้งค่าคุณสมบัติลูกล้อ"
        en="Wheel Attributes · Version → Size → Groove"
      />
      <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 18, lineHeight: 1.6, maxWidth: 720 }}>
        เพิ่ม/แก้รุ่น (เช่น Nylon, Stainless), ขนาด, และร่อง ได้เองโดยไม่ต้องแก้โค้ดหรือฐานข้อมูล · ค่าที่เพิ่มจะใช้ได้ทันทีตอนสร้างล้อดิบ และจัดกลุ่มทั้งระบบตามลำดับ (sort) · ลบได้เฉพาะค่าที่ยังไม่มีล้อดิบใช้งาน
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, alignItems: "start" }}>
        {sections.map((sec) => (
          <Panel
            key={sec.kind}
            title={KIND_TH[sec.kind]}
            en={KIND_EN[sec.kind]}
            pad={0}
            right={
              <Btn kind="soft" size="sm" icon="plus" onClick={() => setEditing({ kind: sec.kind, row: "new" })}>
                เพิ่ม
              </Btn>
            }
          >
            <DataTable
              cols={[
                { label: "รหัส", w: 90 },
                { label: "ไทย" },
                { label: "EN", w: 90 },
                { label: "ลำดับ", right: true, w: 60 },
                { label: "", w: 50 },
              ]}
            >
              {sec.rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--surface-3)" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <span className="mono" style={{ fontSize: 12 }}>{r.id}</span>
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{r.th}</td>
                  <td style={{ padding: "10px 14px", color: "var(--ink-2)" }}>{r.en}</td>
                  <td className="tnum" style={{ padding: "10px 14px", textAlign: "right", color: "var(--ink-3)" }}>{r.sort}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <button
                      onClick={() => setEditing({ kind: sec.kind, row: r })}
                      style={{ border: "none", background: "var(--surface-3)", borderRadius: 8, width: 30, height: 30, color: "var(--ink-2)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Icon name="edit" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {sec.rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 22, textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
                    ยังไม่มีข้อมูล
                  </td>
                </tr>
              )}
            </DataTable>
          </Panel>
        ))}
      </div>

      {editing && (
        <AttrModal
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AttrModal({ editing, onClose, onSaved }: { editing: { kind: AttrKind; row: WheelLookup | "new" }; onClose: () => void; onSaved: () => void }) {
  const isNew = editing.row === "new";
  const row = isNew ? null : (editing.row as WheelLookup);
  const [id, setId] = useState(row?.id ?? "");
  const [idTouched, setIdTouched] = useState(!isNew);
  const [th, setTh] = useState(row?.th ?? "");
  const [en, setEn] = useState(row?.en ?? "");
  const [sort, setSort] = useState(String(row?.sort ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();

  const effId = isNew && !idTouched ? slugify(en) : id;

  const save = () => {
    setError(null);
    start(async () => {
      const res = await saveAttr({ kind: editing.kind, id: effId, th, en, sort: Number(sort) || 0, isNew });
      if (res.ok) onSaved();
      else setError(res.error || "บันทึกไม่สำเร็จ");
    });
  };

  const remove = () => {
    if (isNew) return;
    setError(null);
    start(async () => {
      const res = await deleteAttr(editing.kind, row!.id);
      if (res.ok) onSaved();
      else if (res.error === "IN_USE") setError("ลบไม่ได้ — มีล้อดิบใช้ค่านี้อยู่");
      else setError(res.error || "ลบไม่สำเร็จ");
    });
  };

  return (
    <Modal
      title={`${isNew ? "เพิ่ม" : "แก้ไข"} ${KIND_TH[editing.kind]}`}
      en={KIND_EN[editing.kind]}
      onClose={onClose}
      width={440}
      footer={
        <>
          {!isNew && (
            <Btn kind="danger" icon="trash" onClick={() => setConfirmDel(true)} disabled={pending} style={{ marginRight: "auto" }}>
              ลบ
            </Btn>
          )}
          <Btn kind="ghost" onClick={onClose} disabled={pending}>ยกเลิก</Btn>
          <Btn kind="primary" icon="check" onClick={save} disabled={pending}>
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </Btn>
        </>
      }
    >
      <Field label="รหัส (id)" en={isNew ? "lowercase, ใช้ใน SKU" : "แก้ไขไม่ได้"}>
        <TextInput
          value={effId}
          disabled={!isNew}
          onChange={(e) => {
            setIdTouched(true);
            setId(e.target.value);
          }}
          placeholder="เช่น nylon"
        />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="ชื่อ (ไทย)" en="Thai label">
          <TextInput value={th} onChange={(e) => setTh(e.target.value)} placeholder="เช่น ไนลอน" />
        </Field>
        <Field label="ชื่อ (อังกฤษ)" en="English label">
          <TextInput value={en} onChange={(e) => setEn(e.target.value)} placeholder="เช่น Nylon" />
        </Field>
      </div>
      <Field label="ลำดับ (sort)" en="ใช้จัดเรียงทั้งระบบ — เล็กมาก่อน">
        <TextInput inputMode="numeric" value={sort} onChange={(e) => setSort(e.target.value.replace(/\D/g, ""))} placeholder="เช่น 3" />
      </Field>

      {confirmDel && (
        <div style={{ marginTop: 8, padding: "12px 14px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>ยืนยันการลบ?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn kind="ghost" size="sm" onClick={() => setConfirmDel(false)} disabled={pending}>ยกเลิก</Btn>
            <Btn kind="danger" size="sm" icon="trash" onClick={remove} disabled={pending}>
              {pending ? "กำลังลบ…" : "ยืนยันลบ"}
            </Btn>
          </div>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}
    </Modal>
  );
}
