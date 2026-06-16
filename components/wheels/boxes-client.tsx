"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { rawWheelLabel } from "@/lib/wheels/sku";
import { groupBoxes, flattenGroups } from "@/lib/wheels/grouping";
import { Icon } from "@/components/icon";
import { Btn, DataTable, Field, Modal, Panel, ScreenHead, SearchBox, SelectInput, TextInput, Toggle } from "@/components/ui";
import { saveBox, deleteBox, type BoxInput } from "@/app/admin/(console)/wheels/boxes/actions";

type Editing = WheelBox | "new" | null;

export function BoxesClient({
  boxes,
  raw,
  finishes,
  sizes,
  grooves,
}: {
  boxes: WheelBox[];
  raw: WheelRaw[];
  finishes: WheelLookup[];
  sizes: WheelLookup[];
  grooves: WheelLookup[];
}) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const router = useRouter();

  const rawById = useMemo(() => new Map(raw.map((r) => [r.id, r])), [raw]);
  const rawLabel = (id: string) => {
    const r = rawById.get(id);
    return r ? rawWheelLabel(r, finishes, sizes, grooves) : "—";
  };
  const activeCount = boxes.filter((b) => b.active).length;

  // Canonical Version → Size → Groove ordering (via each box's raw wheel).
  const orderedBoxes = useMemo(() => flattenGroups(groupBoxes(boxes, rawById, finishes, sizes, grooves)), [boxes, rawById, finishes, sizes, grooves]);
  const list = useMemo(() => {
    const query = q.toLowerCase();
    return orderedBoxes.filter(
      (b) => !q || b.sku.toLowerCase().includes(query) || (b.name ?? "").toLowerCase().includes(query) || rawLabel(b.raw_id).toLowerCase().includes(query),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedBoxes, q]);

  return (
    <div className="fade-up">
      <ScreenHead
        th="กล่องบรรจุ"
        en={`Packed Boxes · ${activeCount} SKU`}
        right={
          raw.length === 0 ? undefined : (
            <Btn kind="primary" icon="plus" size="sm" onClick={() => setEditing("new")}>
              เพิ่มกล่องบรรจุ
            </Btn>
          )
        }
      />
      {raw.length === 0 && (
        <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", color: "var(--ink-3)", fontSize: 13 }}>
          ต้องมีล้อดิบอย่างน้อย 1 รายการก่อน จึงจะสร้างกล่องบรรจุได้
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBox value={q} onChange={setQ} placeholder="ค้นหา SKU / ชื่อ / ล้อดิบ" />
      </div>
      <Panel pad={0}>
        <DataTable
          cols={[
            { label: "SKU", w: 150 },
            { label: "ล้อดิบที่บรรจุ" },
            { label: "ต่อกล่อง", right: true, w: 80 },
            { label: "คงเหลือ", right: true, w: 90 },
            { label: "หน่วย", w: 70 },
            { label: "สถานะ", w: 90 },
            { label: "", w: 60 },
          ]}
        >
          {list.map((b) => (
            <tr key={b.id} style={{ borderBottom: "1px solid var(--surface-3)" }}>
              <td style={{ padding: "11px 14px" }}>
                <span className="mono" style={{ fontSize: 12.5 }}>{b.sku}</span>
              </td>
              <td style={{ padding: "11px 14px", fontWeight: 600 }}>
                {rawLabel(b.raw_id)}
                {b.name && <span className="en" style={{ fontSize: 11, marginLeft: 6 }}>{b.name}</span>}
              </td>
              <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", fontWeight: 600 }}>{b.units_per_box}</td>
              <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700, color: b.stock < 0 ? "var(--red-ink)" : "var(--ink)" }}>
                {b.stock.toLocaleString()}
              </td>
              <td style={{ padding: "11px 14px", color: "var(--ink-3)" }}>{b.unit}</td>
              <td style={{ padding: "11px 14px" }}>
                <span className={`pill ${b.active ? "green" : "grey"}`}>{b.active ? "ใช้งาน" : "ปิด"}</span>
              </td>
              <td style={{ padding: "11px 14px" }}>
                <button
                  onClick={() => setEditing(b)}
                  style={{ border: "none", background: "var(--surface-3)", borderRadius: 8, width: 32, height: 32, color: "var(--ink-2)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Icon name="edit" size={15} />
                </button>
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: 28, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>
                ยังไม่มีกล่องบรรจุ
              </td>
            </tr>
          )}
        </DataTable>
      </Panel>

      {editing && (
        <BoxModal
          editing={editing}
          raw={raw}
          finishes={finishes}
          sizes={sizes}
          grooves={grooves}
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

function BoxModal({
  editing,
  raw,
  finishes,
  sizes,
  grooves,
  onClose,
  onSaved,
}: {
  editing: WheelBox | "new";
  raw: WheelRaw[];
  finishes: WheelLookup[];
  sizes: WheelLookup[];
  grooves: WheelLookup[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = editing === "new";
  const b = isNew ? null : editing;
  const [rawId, setRawId] = useState(b?.raw_id ?? raw[0]?.id ?? "");
  const [sku, setSku] = useState(b?.sku ?? "");
  const [name, setName] = useState(b?.name ?? "");
  const [units, setUnits] = useState(String(b?.units_per_box ?? "50"));
  const [unit, setUnit] = useState(b?.unit ?? "กล่อง");
  const [min, setMin] = useState(String(b?.min_stock ?? ""));
  const [order, setOrder] = useState(String(b?.display_order ?? ""));
  const [active, setActive] = useState(isNew ? true : b!.active);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setError(null);
    const input: BoxInput = {
      id: isNew ? undefined : b!.id,
      sku,
      name,
      raw_id: rawId,
      units_per_box: Number(units) || 0,
      unit,
      min_stock: Number(min) || 0,
      display_order: Number(order) || 0,
      active,
    };
    start(async () => {
      const res = await saveBox(input);
      if (res.ok) onSaved();
      else setError(res.error || "บันทึกไม่สำเร็จ");
    });
  };

  const remove = () => {
    if (isNew) return;
    setError(null);
    start(async () => {
      const res = await deleteBox(b!.id);
      if (res.ok) onSaved();
      else if (res.error === "IN_USE") setError("ลบไม่ได้ — กล่องนี้ถูกใช้ใน BOM");
      else setError(res.error || "ลบไม่สำเร็จ");
    });
  };

  return (
    <Modal
      title={isNew ? "เพิ่มกล่องบรรจุ" : "แก้ไขกล่องบรรจุ"}
      en={isNew ? "New packed box" : b!.sku}
      onClose={onClose}
      width={520}
      footer={
        <>
          {!isNew && (
            <Btn kind="danger" icon="trash" onClick={remove} disabled={pending} style={{ marginRight: "auto" }}>
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
      <Field label="ล้อดิบที่บรรจุ" en="Raw wheel">
        <SelectInput value={rawId} onChange={(e) => setRawId(e.target.value)}>
          {raw.map((r) => (
            <option key={r.id} value={r.id}>
              {rawWheelLabel(r, finishes, sizes, grooves)} · {r.sku}
            </option>
          ))}
        </SelectInput>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="SKU" en="Unique code">
          <TextInput value={sku} onChange={(e) => setSku(e.target.value)} placeholder="BOX-CHR-3-RND-50" />
        </Field>
        <Field label="จำนวนต่อกล่อง" en="Units per box">
          <TextInput inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value.replace(/\D/g, ""))} placeholder="50" />
        </Field>
      </div>
      <Field label="ชื่อ/หมายเหตุ (ถ้ามี)" en="Display name · optional">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น กล่อง 50 ลูก" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <Field label="หน่วยนับ" en="Unit">
          <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="กล่อง" />
        </Field>
        <Field label="สต็อกขั้นต่ำ" en="Min level">
          <TextInput inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} placeholder="0" />
        </Field>
        <Field label="ลำดับแสดง" en="Order">
          <TextInput inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value.replace(/\D/g, ""))} placeholder="1" />
        </Field>
      </div>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", marginTop: 4 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>
          เปิดใช้งาน <span className="en">Active</span>
        </span>
        <Toggle on={active} onChange={setActive} />
      </label>

      {error && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}
    </Modal>
  );
}
