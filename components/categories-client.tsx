"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category, ReportUnit, VizType } from "@/lib/types";
import { CAT_ICON } from "@/lib/nav";
import { Icon } from "@/components/icon";
import { Btn, DataTable, Field, Modal, Panel, ScreenHead, SelectInput, TextInput, Toggle } from "@/components/ui";
import { saveCategory, archiveCategory, type CategoryInput } from "@/app/admin/(console)/categories/actions";

type Editing = Category | "new" | null;

export function CategoriesClient({
  categories,
  units,
  vizTypes,
  counts,
}: {
  categories: Category[];
  units: ReportUnit[];
  vizTypes: VizType[];
  counts: Record<string, number>;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const router = useRouter();
  const vizName = (id: string | null) => vizTypes.find((v) => v.id === id)?.th || id || "—";

  return (
    <div className="fade-up">
      <ScreenHead
        th="หมวดหมู่สินค้า"
        en="Categories · each defines its own reporting unit"
        right={
          <Btn kind="primary" icon="plus" size="sm" onClick={() => setEditing("new")}>
            เพิ่มหมวดหมู่
          </Btn>
        }
      />
      <Panel pad={0}>
        <DataTable
          cols={[
            { label: "ลำดับ", w: 64 },
            { label: "หมวดหมู่" },
            { label: "หน่วยรายงาน", w: 130 },
            { label: "การแสดงผล", w: 160 },
            { label: "SKU", right: true, w: 70 },
            { label: "สถานะ", w: 100 },
            { label: "", w: 60 },
          ]}
        >
          {categories.map((c) => (
            <tr key={c.id} style={{ borderBottom: "1px solid var(--surface-3)" }}>
              <td className="tnum" style={{ padding: "12px 14px", color: "var(--ink-3)", fontWeight: 600 }}>
                {c.display_order}
              </td>
              <td style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "none",
                    }}
                  >
                    <Icon name={CAT_ICON[c.id] || "layers"} size={18} />
                  </span>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{c.name}</div>
                    <div className="en" style={{ fontSize: 11 }}>
                      {c.name_en}
                    </div>
                  </div>
                </div>
              </td>
              <td style={{ padding: "12px 14px" }}>
                <span className="pill blue">
                  {c.report_unit_th}
                  {c.secondary_unit_th ? ` + ${c.secondary_unit_th}` : ""}
                </span>
              </td>
              <td style={{ padding: "12px 14px", color: "var(--ink-2)" }}>{vizName(c.viz)}</td>
              <td className="tnum" style={{ padding: "12px 14px", textAlign: "right", color: "var(--ink-3)" }}>
                {counts[c.id] ?? 0}
              </td>
              <td style={{ padding: "12px 14px" }}>
                <span className={`pill ${c.archived ? "grey" : c.active ? "green" : "grey"}`}>
                  {c.archived ? "เก็บถาวร" : c.active ? "ใช้งาน" : "ปิด"}
                </span>
              </td>
              <td style={{ padding: "12px 14px" }}>
                <button
                  onClick={() => setEditing(c)}
                  style={{
                    border: "none",
                    background: "var(--surface-3)",
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    color: "var(--ink-2)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="edit" size={15} />
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
      <div style={{ marginTop: 14, fontSize: 13, color: "var(--ink-3)", display: "flex", gap: 7, alignItems: "center" }}>
        <Icon name="lock" size={14} /> หมวดหมู่ที่มีสินค้าใช้งานอยู่จะลบไม่ได้ — ใช้ &ldquo;เก็บถาวร&rdquo; แทน ·
        หน่วยรายงานต่างกันจะไม่ถูกนำมารวมยอดข้ามหมวด
      </div>

      {editing && (
        <CategoryModal
          editing={editing}
          units={units}
          vizTypes={vizTypes}
          hasProducts={editing !== "new" && (counts[editing.id] ?? 0) > 0}
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

function CategoryModal({
  editing,
  units,
  vizTypes,
  hasProducts,
  onClose,
  onSaved,
}: {
  editing: Category | "new";
  units: ReportUnit[];
  vizTypes: VizType[];
  hasProducts: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = editing === "new";
  const c = isNew ? null : editing;
  const [name, setName] = useState(c?.name ?? "");
  const [nameEn, setNameEn] = useState(c?.name_en ?? "");
  const [unit, setUnit] = useState(c?.report_unit ?? "pcs");
  const [order, setOrder] = useState(String(c?.display_order ?? ""));
  const [viz, setViz] = useState(c?.viz ?? "product");
  const [active, setActive] = useState(isNew ? true : c!.active && !c!.archived);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setError(null);
    const input: CategoryInput = {
      id: isNew ? undefined : c!.id,
      name,
      name_en: nameEn,
      display_order: Number(order) || 0,
      report_unit: unit,
      viz,
      active,
    };
    start(async () => {
      const res = await saveCategory(input);
      if (res.ok) onSaved();
      else setError(res.error || "บันทึกไม่สำเร็จ");
    });
  };

  const archive = () => {
    if (isNew) return;
    setError(null);
    start(async () => {
      const res = await archiveCategory(c!.id);
      if (res.ok) onSaved();
      else setError(res.error || "เก็บถาวรไม่สำเร็จ");
    });
  };

  return (
    <Modal
      title={isNew ? "เพิ่มหมวดหมู่" : "แก้ไขหมวดหมู่"}
      en={isNew ? "New category" : c!.name_en ?? c!.id}
      onClose={onClose}
      width={520}
      footer={
        <>
          {!isNew && (
            <Btn kind="danger" icon="archive" onClick={archive} disabled={pending} style={{ marginRight: "auto" }}>
              เก็บถาวร
            </Btn>
          )}
          <Btn kind="ghost" onClick={onClose} disabled={pending}>
            ยกเลิก
          </Btn>
          <Btn kind="primary" icon="check" onClick={save} disabled={pending}>
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </Btn>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="ชื่อหมวดหมู่ (ไทย)" en="Name (Thai)">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น วัตถุดิบ" />
        </Field>
        <Field label="ชื่อหมวดหมู่ (อังกฤษ)" en="Name (English)">
          <TextInput value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Raw Materials" />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="หน่วยรายงาน" en="Reporting unit">
          <SelectInput value={unit} onChange={(e) => setUnit(e.target.value)}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.th}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="ลำดับการแสดง" en="Display order">
          <TextInput inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value.replace(/\D/g, ""))} placeholder="6" />
        </Field>
      </div>
      <Field label="รูปแบบการแสดงผลบนแดชบอร์ด" en="Dashboard visualization type">
        <SelectInput value={viz} onChange={(e) => setViz(e.target.value)}>
          {vizTypes.map((v) => (
            <option key={v.id} value={v.id}>
              {v.th} · {v.en}
            </option>
          ))}
        </SelectInput>
      </Field>
      <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: -6, marginBottom: 12, lineHeight: 1.5 }}>
        แต่ละหมวดหมู่รายงานด้วยหน่วยของตัวเอง — ระบบจะไม่นำหน่วยที่ต่างกันมารวมเป็นยอดเดียว
      </div>

      {hasProducts && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--surface-3)",
            color: "var(--ink-2)",
            fontSize: 12.5,
            marginBottom: 12,
          }}
        >
          <Icon name="lock" size={14} style={{ flex: "none", marginTop: 1 }} /> หมวดนี้มีสินค้าอยู่ — ลบไม่ได้
        </div>
      )}

      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          borderRadius: 10,
          background: "var(--surface-2)",
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>
          เปิดใช้งานหมวดหมู่ <span className="en">Active</span>
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
