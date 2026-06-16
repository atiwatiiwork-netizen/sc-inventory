"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BomComponentType, WheelAssembly, WheelBomLine, WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { rawWheelLabel } from "@/lib/wheels/sku";
import { Icon } from "@/components/icon";
import { Btn, DataTable, Field, Modal, Panel, ScreenHead, SearchBox, SelectInput, TextInput, Toggle, inputStyle } from "@/components/ui";
import { saveAssembly, deleteAssembly, type AssemblyInput, type BomLineInput } from "@/app/admin/(console)/wheels/assemblies/actions";

type Editing = WheelAssembly | "new" | null;

type Lookups = { raw: WheelRaw[]; boxes: WheelBox[]; finishes: WheelLookup[]; sizes: WheelLookup[]; grooves: WheelLookup[] };

const TYPE_LABEL: Record<BomComponentType, string> = { raw: "ล้อดิบ", box: "กล่องบรรจุ", part: "ชิ้นส่วนอื่น" };

export function AssembliesClient({
  assemblies,
  bom,
  raw,
  boxes,
  finishes,
  sizes,
  grooves,
}: {
  assemblies: WheelAssembly[];
  bom: WheelBomLine[];
  raw: WheelRaw[];
  boxes: WheelBox[];
  finishes: WheelLookup[];
  sizes: WheelLookup[];
  grooves: WheelLookup[];
}) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const router = useRouter();
  const lookups: Lookups = { raw, boxes, finishes, sizes, grooves };

  const bomByAssembly = useMemo(() => {
    const m = new Map<string, WheelBomLine[]>();
    for (const l of bom) {
      const arr = m.get(l.assembly_id) ?? [];
      arr.push(l);
      m.set(l.assembly_id, arr);
    }
    return m;
  }, [bom]);

  const activeCount = assemblies.filter((a) => a.active).length;
  const list = useMemo(() => {
    const query = q.toLowerCase();
    return assemblies.filter(
      (a) => !q || a.sku.toLowerCase().includes(query) || a.name.toLowerCase().includes(query) || (a.name_en ?? "").toLowerCase().includes(query),
    );
  }, [assemblies, q]);

  return (
    <div className="fade-up">
      <ScreenHead
        th="สินค้าประกอบ"
        en={`Assemblies · ${activeCount} SKU`}
        right={
          <Btn kind="primary" icon="plus" size="sm" onClick={() => setEditing("new")}>
            เพิ่มสินค้าประกอบ
          </Btn>
        }
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBox value={q} onChange={setQ} placeholder="ค้นหา SKU / ชื่อสินค้า" />
      </div>
      <Panel pad={0}>
        <DataTable
          cols={[
            { label: "SKU", w: 150 },
            { label: "ชื่อสินค้า" },
            { label: "คงเหลือ", right: true, w: 90 },
            { label: "BOM", right: true, w: 80 },
            { label: "หน่วย", w: 70 },
            { label: "สถานะ", w: 90 },
            { label: "", w: 60 },
          ]}
        >
          {list.map((a) => (
            <tr key={a.id} style={{ borderBottom: "1px solid var(--surface-3)" }}>
              <td style={{ padding: "11px 14px" }}>
                <span className="mono" style={{ fontSize: 12.5 }}>{a.sku}</span>
              </td>
              <td style={{ padding: "11px 14px", fontWeight: 600 }}>
                {a.name} {a.name_en && <span className="en" style={{ fontSize: 11 }}>{a.name_en}</span>}
              </td>
              <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700, color: a.stock < 0 ? "var(--red-ink)" : "var(--ink)" }}>
                {a.stock.toLocaleString()}
              </td>
              <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", color: "var(--ink-3)" }}>
                {bomByAssembly.get(a.id)?.length ?? 0} รายการ
              </td>
              <td style={{ padding: "11px 14px", color: "var(--ink-3)" }}>{a.unit}</td>
              <td style={{ padding: "11px 14px" }}>
                <span className={`pill ${a.active ? "green" : "grey"}`}>{a.active ? "ใช้งาน" : "ปิด"}</span>
              </td>
              <td style={{ padding: "11px 14px" }}>
                <button
                  onClick={() => setEditing(a)}
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
                ยังไม่มีสินค้าประกอบ
              </td>
            </tr>
          )}
        </DataTable>
      </Panel>

      {editing && (
        <AssemblyModal
          editing={editing}
          initialBom={editing === "new" ? [] : (bomByAssembly.get(editing.id) ?? [])}
          lookups={lookups}
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

type DraftLine = BomLineInput & { key: string };

let lineSeq = 0;
const newLine = (): DraftLine => ({ key: `l${lineSeq++}`, component_type: "raw", raw_id: null, box_id: null, part_name: null, qty: 1, unit: null });

function AssemblyModal({
  editing,
  initialBom,
  lookups,
  onClose,
  onSaved,
}: {
  editing: WheelAssembly | "new";
  initialBom: WheelBomLine[];
  lookups: Lookups;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = editing === "new";
  const a = isNew ? null : editing;
  const { raw, boxes, finishes, sizes, grooves } = lookups;

  const [sku, setSku] = useState(a?.sku ?? "");
  const [name, setName] = useState(a?.name ?? "");
  const [nameEn, setNameEn] = useState(a?.name_en ?? "");
  const [unit, setUnit] = useState(a?.unit ?? "ชิ้น");
  const [min, setMin] = useState(String(a?.min_stock ?? ""));
  const [order, setOrder] = useState(String(a?.display_order ?? ""));
  const [active, setActive] = useState(isNew ? true : a!.active);
  const [lines, setLines] = useState<DraftLine[]>(
    initialBom.map((l) => ({
      key: `e${l.id}`,
      component_type: l.component_type,
      raw_id: l.raw_id,
      box_id: l.box_id,
      part_name: l.part_name,
      qty: l.qty,
      unit: l.unit,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const patchLine = (key: string, patch: Partial<DraftLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));

  const save = () => {
    setError(null);
    const input: AssemblyInput = {
      id: isNew ? undefined : a!.id,
      sku,
      name,
      name_en: nameEn,
      unit,
      min_stock: Number(min) || 0,
      display_order: Number(order) || 0,
      active,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      bom: lines.map(({ key, ...l }) => l),
    };
    start(async () => {
      const res = await saveAssembly(input);
      if (res.ok) onSaved();
      else setError(res.error || "บันทึกไม่สำเร็จ");
    });
  };

  const remove = () => {
    if (isNew) return;
    setError(null);
    start(async () => {
      const res = await deleteAssembly(a!.id);
      if (res.ok) onSaved();
      else setError(res.error || "ลบไม่สำเร็จ");
    });
  };

  return (
    <Modal
      title={isNew ? "เพิ่มสินค้าประกอบ" : "แก้ไขสินค้าประกอบ"}
      en={isNew ? "New assembly" : a!.sku}
      onClose={onClose}
      width={640}
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="SKU" en="Unique code">
          <TextInput value={sku} onChange={(e) => setSku(e.target.value)} placeholder="ASM-..." />
        </Field>
        <Field label="หน่วยนับ" en="Unit">
          <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ชิ้น" />
        </Field>
      </div>
      <Field label="ชื่อสินค้า" en="Product name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อสินค้าประกอบ" />
      </Field>
      <Field label="ชื่อสินค้า (อังกฤษ)" en="Name (English) · optional">
        <TextInput value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="สต็อกขั้นต่ำ" en="Min level">
          <TextInput inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} placeholder="0" />
        </Field>
        <Field label="ลำดับแสดง" en="Order">
          <TextInput inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value.replace(/\D/g, ""))} placeholder="1" />
        </Field>
      </div>

      {/* BOM editor */}
      <div style={{ marginTop: 6, marginBottom: 8, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13.5, fontWeight: 700 }}>
          สูตรการผลิต (BOM) <span className="en" style={{ fontSize: 11 }}>Bill of Materials</span>
        </span>
        <Btn kind="soft" size="sm" icon="plus" onClick={() => setLines((ls) => [...ls, newLine()])}>
          เพิ่มบรรทัด
        </Btn>
      </div>

      {lines.length === 0 ? (
        <div style={{ padding: "16px 14px", borderRadius: 10, background: "var(--surface-2)", color: "var(--ink-4)", fontSize: 13, textAlign: "center" }}>
          ยังไม่มีส่วนประกอบ — กด “เพิ่มบรรทัด” เพื่อกำหนดสูตร
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lines.map((l) => (
            <div key={l.key} style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px 90px 34px", gap: 8, alignItems: "center" }}>
              <select
                value={l.component_type}
                onChange={(e) => patchLine(l.key, { component_type: e.target.value as BomComponentType, raw_id: null, box_id: null, part_name: null })}
                style={{ ...inputStyle, padding: "8px 10px" }}
              >
                {(["raw", "box", "part"] as BomComponentType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                ))}
              </select>

              {l.component_type === "raw" && (
                <select value={l.raw_id ?? ""} onChange={(e) => patchLine(l.key, { raw_id: e.target.value || null })} style={{ ...inputStyle, padding: "8px 10px" }}>
                  <option value="">— เลือกล้อดิบ —</option>
                  {raw.map((r) => (
                    <option key={r.id} value={r.id}>{rawWheelLabel(r, finishes, sizes, grooves)}</option>
                  ))}
                </select>
              )}
              {l.component_type === "box" && (
                <select value={l.box_id ?? ""} onChange={(e) => patchLine(l.key, { box_id: e.target.value || null })} style={{ ...inputStyle, padding: "8px 10px" }}>
                  <option value="">— เลือกกล่องบรรจุ —</option>
                  {boxes.map((b) => (
                    <option key={b.id} value={b.id}>{b.name ?? b.sku} ({b.units_per_box})</option>
                  ))}
                </select>
              )}
              {l.component_type === "part" && (
                <input
                  value={l.part_name ?? ""}
                  onChange={(e) => patchLine(l.key, { part_name: e.target.value })}
                  placeholder="ชื่อชิ้นส่วน เช่น แกนเพลา"
                  style={{ ...inputStyle, padding: "8px 10px" }}
                />
              )}

              <input
                inputMode="decimal"
                value={String(l.qty)}
                onChange={(e) => patchLine(l.key, { qty: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })}
                placeholder="จำนวน"
                style={{ ...inputStyle, padding: "8px 10px", textAlign: "right" }}
              />
              <input
                value={l.unit ?? ""}
                onChange={(e) => patchLine(l.key, { unit: e.target.value })}
                placeholder="หน่วย"
                style={{ ...inputStyle, padding: "8px 10px" }}
              />
              <button
                onClick={() => removeLine(l.key)}
                title="ลบบรรทัด"
                style={{ border: "none", background: "var(--red-soft)", color: "var(--red-ink)", borderRadius: 8, width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              >
                <Icon name="x" size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", marginTop: 14 }}>
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
