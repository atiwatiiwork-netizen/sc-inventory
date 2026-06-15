"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CustomerGroup } from "@/lib/types";
import { GROUP_ICON, GROUP_COLOR } from "@/lib/nav";
import { Icon, type IconName } from "@/components/icon";
import { Btn, Field, Modal, Panel, ScreenHead, TextInput, Toggle } from "@/components/ui";
import { saveGroup, setGroupActive } from "@/app/admin/(console)/customer-groups/actions";

type Editing = CustomerGroup | "new" | null;

export function GroupsClient({ groups }: { groups: CustomerGroup[] }) {
  const [editing, setEditing] = useState<Editing>(null);
  const router = useRouter();

  return (
    <div className="fade-up">
      <ScreenHead
        th="กลุ่มลูกค้า"
        en="Customer Groups"
        right={
          <Btn kind="primary" icon="plus" size="sm" onClick={() => setEditing("new")}>
            เพิ่มกลุ่ม
          </Btn>
        }
      />
      <Panel pad={0}>
        {groups.map((g, i) => (
          <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", borderBottom: i < groups.length - 1 ? "1px solid var(--surface-3)" : "none" }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: (GROUP_COLOR[g.id] || "#64748b") + "1a", color: GROUP_COLOR[g.id] || "#64748b", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <Icon name={(GROUP_ICON[g.id] as IconName) || "users"} size={22} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 600 }}>{g.name}</div>
              <div className="en" style={{ fontSize: 12 }}>{g.name_en}</div>
            </div>
            <ActiveToggle id={g.id} on={g.active} />
            <button onClick={() => setEditing(g)} style={{ border: "none", background: "var(--surface-3)", borderRadius: 9, width: 34, height: 34, color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="edit" size={16} />
            </button>
          </div>
        ))}
        {groups.length === 0 && <div style={{ padding: 28, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>ยังไม่มีกลุ่มลูกค้า</div>}
      </Panel>
      <div style={{ marginTop: 14, fontSize: 13, color: "var(--ink-3)", display: "flex", gap: 7, alignItems: "center" }}>
        <Icon name="lock" size={14} /> ปิดใช้งานกลุ่มแทนการลบ — กลุ่มที่ปิดจะไม่ขึ้นให้พนักงานเลือก
      </div>

      {editing && (
        <GroupModal
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

function ActiveToggle({ id, on }: { id: string; on: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <span style={{ opacity: pending ? 0.5 : 1 }}>
      <Toggle on={on} onChange={(v) => start(async () => { await setGroupActive(id, v); router.refresh(); })} />
    </span>
  );
}

function GroupModal({ editing, onClose, onSaved }: { editing: CustomerGroup | "new"; onClose: () => void; onSaved: () => void }) {
  const isNew = editing === "new";
  const g = isNew ? null : editing;
  const [name, setName] = useState(g?.name ?? "");
  const [nameEn, setNameEn] = useState(g?.name_en ?? "");
  const [active, setActive] = useState(isNew ? true : g!.active);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setError(null);
    start(async () => {
      const res = await saveGroup({ id: isNew ? undefined : g!.id, name, name_en: nameEn, active });
      if (res.ok) onSaved();
      else setError(res.error || "บันทึกไม่สำเร็จ");
    });
  };

  return (
    <Modal
      title={isNew ? "เพิ่มกลุ่มลูกค้า" : "แก้ไขกลุ่ม"}
      en={isNew ? "New group" : g!.name_en ?? g!.id}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose} disabled={pending}>ยกเลิก</Btn>
          <Btn kind="primary" icon="check" onClick={save} disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึก"}</Btn>
        </>
      }
    >
      <Field label="ชื่อกลุ่ม (ไทย)" en="Name (Thai)">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ลูกค้าหน้าร้าน" />
      </Field>
      <Field label="ชื่อกลุ่ม (อังกฤษ)" en="Name (English)">
        <TextInput value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Walk-in" />
      </Field>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>เปิดใช้งาน <span className="en">Active</span></span>
        <Toggle on={active} onChange={setActive} />
      </label>
      {error && <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>{error}</div>}
    </Modal>
  );
}
