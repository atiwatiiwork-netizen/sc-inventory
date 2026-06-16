"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WorkerRole } from "@/lib/wheels/types";
import type { WheelsWorkerFunction } from "@/lib/wheels/worker-functions";
import { slugify } from "@/lib/wheels/sku";
import { Icon } from "@/components/icon";
import { Btn, DataTable, Field, Modal, Panel, ScreenHead, TextInput, Toggle } from "@/components/ui";
import { saveWorkerRole, deleteWorkerRole, setFunctionRole, type RoleInput } from "@/app/admin/(console)/wheels/worker-access/actions";

type Editing = WorkerRole | "new" | null;

export function WorkerAccessClient({
  roles,
  maps,
  functions,
  workerCounts,
}: {
  roles: WorkerRole[];
  maps: { function_key: string; role_id: string }[];
  functions: WheelsWorkerFunction[];
  workerCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const checked = useMemo(() => new Set(maps.map((m) => `${m.function_key}|${m.role_id}`)), [maps]);
  const activeRoles = roles.filter((r) => r.active);
  const fnRoleCount = (fnKey: string) => maps.filter((m) => m.function_key === fnKey).length;

  const toggle = (fnKey: string, roleId: string, next: boolean) => {
    setErr(null);
    start(async () => {
      const res = await setFunctionRole(fnKey, roleId, next);
      if (res.ok) router.refresh();
      else setErr(res.error || "บันทึกไม่สำเร็จ");
    });
  };

  return (
    <div className="fade-up">
      <ScreenHead
        th="สิทธิ์พนักงาน (SC Wheels)"
        en="Worker Access · function availability by role"
        right={
          <Btn kind="primary" icon="plus" size="sm" onClick={() => setEditing("new")}>
            เพิ่มบทบาท
          </Btn>
        }
      />
      <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 16, lineHeight: 1.6, maxWidth: 760 }}>
        กำหนดว่าแต่ละ <b>บทบาท (role)</b> ใช้ฟังก์ชันใดของพนักงานใน SC Wheels ได้บ้าง · <b>ไม่ติ๊กเลยในแถวใด = ฟังก์ชันนั้นใช้ได้ทุกคน</b> (ค่าเริ่มต้น) · เป็นการเปิด/ปิด “การมองเห็นฟังก์ชัน” ไม่ใช่สิทธิ์แบบ ERP
      </div>

      {err && (
        <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>{err}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 16, alignItems: "start" }}>
        {/* roles */}
        <Panel title="บทบาทพนักงาน" en="Roles" pad={0}>
          <DataTable cols={[{ label: "บทบาท" }, { label: "พนักงาน", right: true, w: 70 }, { label: "", w: 50 }]}>
            {roles.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--surface-3)" }}>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ fontWeight: 600 }}>
                    {r.name} {r.is_system && <span className="pill grey" style={{ marginLeft: 4 }}>ระบบ</span>} {!r.active && <span className="pill grey">ปิด</span>}
                  </div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{r.id}{r.name_en ? ` · ${r.name_en}` : ""}</div>
                </td>
                <td className="tnum" style={{ padding: "10px 14px", textAlign: "right", color: "var(--ink-3)" }}>{workerCounts[r.id] ?? 0}</td>
                <td style={{ padding: "10px 14px" }}>
                  {!r.is_system && (
                    <button onClick={() => setEditing(r)} style={{ border: "none", background: "var(--surface-3)", borderRadius: 8, width: 30, height: 30, color: "var(--ink-2)" }}>
                      <Icon name="edit" size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </Panel>

        {/* matrix */}
        <Panel title="สิทธิ์การใช้ฟังก์ชัน" en="Function × Role" pad={0}>
          <div style={{ overflowX: "auto" }} className="scroll">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "var(--ink-3)" }}>ฟังก์ชัน</th>
                  {activeRoles.map((r) => (
                    <th key={r.id} style={{ padding: "10px 10px", fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", textAlign: "center", whiteSpace: "nowrap" }}>{r.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {functions.map((f) => {
                  const openToAll = fnRoleCount(f.key) === 0;
                  return (
                    <tr key={f.key} style={{ borderBottom: "1px solid var(--surface-3)" }}>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ fontWeight: 600 }}>{f.th} <span className="en" style={{ fontSize: 11 }}>{f.en}</span></div>
                        <div style={{ fontSize: 11, color: openToAll ? "var(--green-ink)" : "var(--ink-4)" }}>{openToAll ? "ใช้ได้ทุกคน" : "จำกัดเฉพาะบทบาทที่ติ๊ก"}</div>
                      </td>
                      {activeRoles.map((r) => {
                        const on = checked.has(`${f.key}|${r.id}`);
                        return (
                          <td key={r.id} style={{ textAlign: "center", padding: "8px 10px" }}>
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={pending}
                              onChange={(e) => toggle(f.key, r.id, e.target.checked)}
                              style={{ width: 18, height: 18, cursor: pending ? "default" : "pointer", accentColor: "var(--accent)" }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {editing && (
        <RoleModal
          editing={editing}
          workerCount={editing === "new" ? 0 : workerCounts[editing.id] ?? 0}
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

function RoleModal({ editing, workerCount, onClose, onSaved }: { editing: WorkerRole | "new"; workerCount: number; onClose: () => void; onSaved: () => void }) {
  const isNew = editing === "new";
  const r = isNew ? null : editing;
  const [id, setId] = useState(r?.id ?? "");
  const [idTouched, setIdTouched] = useState(!isNew);
  const [name, setName] = useState(r?.name ?? "");
  const [nameEn, setNameEn] = useState(r?.name_en ?? "");
  const [sort, setSort] = useState(String(r?.sort ?? ""));
  const [active, setActive] = useState(isNew ? true : r!.active);
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();

  const effId = isNew && !idTouched ? slugify(nameEn || name) : id;

  const save = () => {
    setError(null);
    const input: RoleInput = { id: effId, name, name_en: nameEn, sort: Number(sort) || 0, active, isNew };
    start(async () => {
      const res = await saveWorkerRole(input);
      if (res.ok) onSaved();
      else setError(res.error || "บันทึกไม่สำเร็จ");
    });
  };
  const remove = () => {
    if (isNew) return;
    setError(null);
    start(async () => {
      const res = await deleteWorkerRole(r!.id);
      if (res.ok) onSaved();
      else if (res.error === "IN_USE_WORKERS") setError("ลบไม่ได้ — มีพนักงานใช้บทบาทนี้อยู่");
      else if (res.error === "IN_USE_MAPPINGS") setError("ลบไม่ได้ — บทบาทนี้ถูกผูกกับฟังก์ชันอยู่ (เอาออกจากตารางสิทธิ์ก่อน)");
      else setError(res.error || "ลบไม่สำเร็จ");
    });
  };

  return (
    <Modal
      title={isNew ? "เพิ่มบทบาท" : "แก้ไขบทบาท"}
      en={isNew ? "New role" : effId}
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
      <Field label="รหัส (id)" en={isNew ? "lowercase" : "แก้ไขไม่ได้"}>
        <TextInput value={effId} disabled={!isNew} onChange={(e) => { setIdTouched(true); setId(e.target.value); }} placeholder="เช่น packer" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="ชื่อ (ไทย)" en="Thai">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ฝ่ายแพ็ค" />
        </Field>
        <Field label="ชื่อ (อังกฤษ)" en="English">
          <TextInput value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="เช่น Packer" />
        </Field>
      </div>
      <Field label="ลำดับ (sort)" en="Order">
        <TextInput inputMode="numeric" value={sort} onChange={(e) => setSort(e.target.value.replace(/\D/g, ""))} placeholder="1" />
      </Field>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>เปิดใช้งาน <span className="en">Active</span></span>
        <Toggle on={active} onChange={setActive} />
      </label>

      {confirmDel && (
        <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>ยืนยันการลบบทบาท?</div>
          <div style={{ marginBottom: 10, fontWeight: 400 }}>ลบได้เฉพาะเมื่อไม่มีพนักงานใช้ ({workerCount} คน) และไม่ได้ผูกกับฟังก์ชันใด</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn kind="ghost" size="sm" onClick={() => setConfirmDel(false)} disabled={pending}>ยกเลิก</Btn>
            <Btn kind="danger" size="sm" icon="trash" onClick={remove} disabled={pending}>{pending ? "กำลังลบ…" : "ยืนยันลบ"}</Btn>
          </div>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>{error}</div>
      )}
    </Modal>
  );
}
