"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { suggestRawSku } from "@/lib/wheels/sku";
import { groupRawWheels, flattenGroups } from "@/lib/wheels/grouping";
import { RawBulkClient } from "@/components/wheels/raw-bulk-client";
import { Icon } from "@/components/icon";
import { Btn, DataTable, Field, Modal, Panel, ScreenHead, SearchBox, SelectInput, TextInput, Toggle } from "@/components/ui";
import { saveRawWheel, deleteRawWheel, type RawInput } from "@/app/admin/(console)/wheels/raw/actions";

type Editing = WheelRaw | "new" | null;

export function RawClient({
  raw,
  finishes,
  sizes,
  grooves,
}: {
  raw: WheelRaw[];
  finishes: WheelLookup[];
  sizes: WheelLookup[];
  grooves: WheelLookup[];
}) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const [bulk, setBulk] = useState(false);
  const router = useRouter();

  const lk = (rows: WheelLookup[], id: string) => rows.find((r) => r.id === id);
  const labelOf = (r: WheelRaw) =>
    `${lk(finishes, r.finish)?.en ?? r.finish} ${lk(sizes, r.size)?.en ?? r.size} ${lk(grooves, r.groove)?.en ?? r.groove}`;

  const activeCount = raw.filter((r) => r.active).length;

  // Canonical Version → Size → Groove ordering (size small → large).
  const orderedRaw = useMemo(() => flattenGroups(groupRawWheels(raw, finishes, sizes, grooves)), [raw, finishes, sizes, grooves]);
  const list = useMemo(() => {
    const query = q.toLowerCase();
    return orderedRaw.filter(
      (r) => !q || r.sku.toLowerCase().includes(query) || (r.name ?? "").toLowerCase().includes(query) || labelOf(r).toLowerCase().includes(query),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedRaw, q]);

  if (bulk)
    return (
      <RawBulkClient
        raw={raw}
        finishes={finishes}
        sizes={sizes}
        grooves={grooves}
        onClose={() => setBulk(false)}
        onDone={() => router.refresh()}
      />
    );

  return (
    <div className="fade-up">
      <ScreenHead
        th="ล้อดิบ"
        en={`Raw Wheels · ${activeCount} SKU`}
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <Btn kind="default" icon="grid" size="sm" onClick={() => setBulk(true)}>
              เพิ่มหลายรายการ
            </Btn>
            <Btn kind="primary" icon="plus" size="sm" onClick={() => setEditing("new")}>
              เพิ่มล้อดิบ
            </Btn>
          </div>
        }
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBox value={q} onChange={setQ} placeholder="ค้นหา SKU / ชื่อ / รุ่น ขนาด ร่อง" />
      </div>
      <Panel pad={0}>
        <DataTable
          cols={[
            { label: "SKU", w: 150 },
            { label: "รายละเอียด" },
            { label: "คงเหลือ", right: true, w: 90 },
            { label: "หน่วย", w: 70 },
            { label: "ลำดับ", right: true, w: 70 },
            { label: "สถานะ", w: 90 },
            { label: "", w: 60 },
          ]}
        >
          {list.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid var(--surface-3)" }}>
              <td style={{ padding: "11px 14px" }}>
                <span className="mono" style={{ fontSize: 12.5 }}>{r.sku}</span>
              </td>
              <td style={{ padding: "11px 14px", fontWeight: 600 }}>
                {labelOf(r)}
                {r.name && <span className="en" style={{ fontSize: 11, marginLeft: 6 }}>{r.name}</span>}
              </td>
              <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700, color: r.stock < 0 ? "var(--red-ink)" : "var(--ink)" }}>
                {r.stock.toLocaleString()}
              </td>
              <td style={{ padding: "11px 14px", color: "var(--ink-3)" }}>{r.unit}</td>
              <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", color: "var(--ink-3)" }}>{r.display_order}</td>
              <td style={{ padding: "11px 14px" }}>
                <span className={`pill ${r.active ? "green" : "grey"}`}>{r.active ? "ใช้งาน" : "ปิด"}</span>
              </td>
              <td style={{ padding: "11px 14px" }}>
                <button
                  onClick={() => setEditing(r)}
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
                ยังไม่มีล้อดิบ
              </td>
            </tr>
          )}
        </DataTable>
      </Panel>

      {editing && (
        <RawModal
          editing={editing}
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

function RawModal({
  editing,
  finishes,
  sizes,
  grooves,
  onClose,
  onSaved,
}: {
  editing: WheelRaw | "new";
  finishes: WheelLookup[];
  sizes: WheelLookup[];
  grooves: WheelLookup[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = editing === "new";
  const r = isNew ? null : editing;
  const [finish, setFinish] = useState(r?.finish ?? finishes[0]?.id ?? "");
  const [size, setSize] = useState(r?.size ?? sizes[0]?.id ?? "");
  const [groove, setGroove] = useState(r?.groove ?? grooves[0]?.id ?? "");
  const [sku, setSku] = useState(r?.sku ?? "");
  const [skuTouched, setSkuTouched] = useState(!isNew);
  const [name, setName] = useState(r?.name ?? "");
  const [unit, setUnit] = useState(r?.unit ?? "ลูก");
  const [min, setMin] = useState(String(r?.min_stock ?? ""));
  const [order, setOrder] = useState(String(r?.display_order ?? ""));
  const [active, setActive] = useState(isNew ? true : r!.active);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // auto-suggest SKU from attributes until the admin edits it manually
  const effSku = skuTouched ? sku : suggestRawSku(finish, size, groove);

  const save = () => {
    setError(null);
    const input: RawInput = {
      id: isNew ? undefined : r!.id,
      sku: effSku,
      name,
      finish,
      size,
      groove,
      unit,
      min_stock: Number(min) || 0,
      display_order: Number(order) || 0,
      active,
    };
    start(async () => {
      const res = await saveRawWheel(input);
      if (res.ok) onSaved();
      else setError(res.error || "บันทึกไม่สำเร็จ");
    });
  };

  const remove = () => {
    if (isNew) return;
    setError(null);
    start(async () => {
      const res = await deleteRawWheel(r!.id);
      if (res.ok) onSaved();
      else if (res.error === "IN_USE") setError("ลบไม่ได้ — ล้อดิบนี้ถูกใช้ในกล่องบรรจุหรือ BOM");
      else setError(res.error || "ลบไม่สำเร็จ");
    });
  };

  return (
    <Modal
      title={isNew ? "เพิ่มล้อดิบ" : "แก้ไขล้อดิบ"}
      en={isNew ? "New raw wheel" : r!.sku}
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <Field label="รุ่น/เวอร์ชัน" en="Version">
          <SelectInput value={finish} onChange={(e) => setFinish(e.target.value)}>
            {finishes.map((f) => (
              <option key={f.id} value={f.id}>{f.th} · {f.en}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="ขนาด" en="Size">
          <SelectInput value={size} onChange={(e) => setSize(e.target.value)}>
            {sizes.map((s) => (
              <option key={s.id} value={s.id}>{s.en}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="ร่อง" en="Groove">
          <SelectInput value={groove} onChange={(e) => setGroove(e.target.value)}>
            {grooves.map((g) => (
              <option key={g.id} value={g.id}>{g.th} · {g.en}</option>
            ))}
          </SelectInput>
        </Field>
      </div>
      <Field label="SKU" en="Unique code (auto-suggested)">
        <TextInput
          value={effSku}
          onChange={(e) => {
            setSkuTouched(true);
            setSku(e.target.value);
          }}
          placeholder="WHL-CHR-3-RND"
        />
      </Field>
      <Field label="ชื่อ/หมายเหตุ (ถ้ามี)" en="Display name · optional">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ล้อโครเมียม 3 นิ้ว ร่องกลม" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <Field label="หน่วยนับ" en="Unit">
          <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ลูก" />
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
