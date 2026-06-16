"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Worker } from "@/lib/types";
import type { WorkerRole } from "@/lib/wheels/types";
import { Icon } from "@/components/icon";
import { Btn, DataTable, Field, Modal, Panel, ScreenHead, SelectInput, TextInput, Toggle } from "@/components/ui";
import { saveWorker, setWorkerActive } from "@/app/admin/(console)/workers/actions";

type Editing = Worker | "new" | null;

export function WorkersClient({ workers, roles }: { workers: Worker[]; roles: WorkerRole[] }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const router = useRouter();
  const roleName = (id: string | null) => roles.find((r) => r.id === id)?.name ?? (id ?? "—");

  return (
    <div className="fade-up">
      <ScreenHead
        th="จัดการ PIN พนักงาน"
        en="Worker PIN Management"
        right={
          <Btn kind="primary" icon="plus" size="sm" onClick={() => setEditing("new")}>
            เพิ่มพนักงาน
          </Btn>
        }
      />
      <Panel pad={0}>
        <DataTable
          cols={[
            { label: "รหัส", w: 120 },
            { label: "ชื่อแสดง" },
            { label: "บทบาท", w: 120 },
            { label: "PIN", w: 140 },
            { label: "สถานะ", w: 110 },
            { label: "", w: 70 },
          ]}
        >
          {workers.map((w) => (
            <tr key={w.id} style={{ borderBottom: "1px solid var(--surface-3)" }}>
              <td style={{ padding: "13px 14px" }}><span className="mono" style={{ fontSize: 13 }}>{w.code}</span></td>
              <td style={{ padding: "13px 14px", fontWeight: 600 }}>{w.name} <span className="en" style={{ fontSize: 11 }}>{w.name_en}</span></td>
              <td style={{ padding: "13px 14px" }}><span className="pill blue">{roleName(w.role_id)}</span></td>
              <td style={{ padding: "13px 14px" }}>
                <button
                  onClick={() => setReveal((r) => ({ ...r, [w.id]: !r[w.id] }))}
                  style={{ border: "1px solid var(--border-2)", background: "var(--surface)", borderRadius: 8, padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                >
                  <span className="mono" style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2 }}>{reveal[w.id] ? w.pin : "••••"}</span>
                  <Icon name={reveal[w.id] ? "x" : "key"} size={13} style={{ color: "var(--ink-3)" }} />
                </button>
              </td>
              <td style={{ padding: "13px 14px" }}><ActiveToggle id={w.id} on={w.active} /></td>
              <td style={{ padding: "13px 14px" }}>
                <button onClick={() => setEditing(w)} style={{ border: "none", background: "var(--surface-3)", borderRadius: 8, width: 32, height: 32, color: "var(--ink-2)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="edit" size={15} />
                </button>
              </td>
            </tr>
          ))}
          {workers.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 28, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>ยังไม่มีพนักงาน</td></tr>
          )}
        </DataTable>
      </Panel>
      <div style={{ marginTop: 14, fontSize: 13, color: "var(--ink-3)", display: "flex", gap: 7, alignItems: "center" }}>
        <Icon name="lock" size={14} /> PIN ต้องเป็นตัวเลข 4 หลัก และไม่ซ้ำกับพนักงานคนอื่น
      </div>

      {editing && (
        <WorkerModal editing={editing} roles={roles} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />
      )}
    </div>
  );
}

function ActiveToggle({ id, on }: { id: string; on: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <span style={{ opacity: pending ? 0.5 : 1 }}>
      <Toggle on={on} onChange={(v) => start(async () => { await setWorkerActive(id, v); router.refresh(); })} />
    </span>
  );
}

function WorkerModal({ editing, roles, onClose, onSaved }: { editing: Worker | "new"; roles: WorkerRole[]; onClose: () => void; onSaved: () => void }) {
  const isNew = editing === "new";
  const w = isNew ? null : editing;
  const [code, setCode] = useState(w?.code ?? "");
  const [name, setName] = useState(w?.name ?? "");
  const [pin, setPin] = useState(w?.pin ?? "");
  const [roleId, setRoleId] = useState(w?.role_id ?? "general");
  const [active, setActive] = useState(isNew ? true : w!.active);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setError(null);
    start(async () => {
      const res = await saveWorker({ id: isNew ? undefined : w!.id, code, name, pin, active, role_id: roleId });
      if (res.ok) onSaved();
      else setError(res.error || "บันทึกไม่สำเร็จ");
    });
  };

  return (
    <Modal
      title={isNew ? "เพิ่มพนักงาน" : "แก้ไขพนักงาน"}
      en={isNew ? "New worker" : w!.code}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose} disabled={pending}>ยกเลิก</Btn>
          <Btn kind="primary" icon="check" onClick={save} disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึก"}</Btn>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="รหัสพนักงาน" en="Employee code">
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="EMP005" />
        </Field>
        <Field label="PIN 4 หลัก" en="4-digit PIN">
          <TextInput inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="5555" />
        </Field>
      </div>
      <Field label="ชื่อแสดง" en="Display name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อพนักงาน" />
      </Field>
      <Field label="บทบาท" en="Role · controls SC Wheels function access">
        <SelectInput value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}{r.name_en ? ` · ${r.name_en}` : ""}</option>
          ))}
        </SelectInput>
      </Field>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>เปิดใช้งาน <span className="en">Active</span></span>
        <Toggle on={active} onChange={setActive} />
      </label>
      {error && <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>{error}</div>}
    </Modal>
  );
}
