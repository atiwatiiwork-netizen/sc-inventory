"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category, Product } from "@/lib/types";
import { Icon } from "@/components/icon";
import { Btn, DataTable, Field, Modal, Panel, ScreenHead, SearchBox, SelectInput, TextInput, Toggle } from "@/components/ui";
import { saveProduct, deleteProduct, type ProductInput } from "@/app/admin/(console)/products/actions";

type Editing = Product | "new" | null;

export function ProductsClient({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState<Editing>(null);
  const router = useRouter();
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? id ?? "—";

  const list = useMemo(() => {
    const query = q.toLowerCase();
    return products.filter(
      (p) =>
        (cat === "all" || p.category_id === cat) &&
        (!q ||
          p.name.includes(q) ||
          (p.name_en ?? "").toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query)),
    );
  }, [products, cat, q]);

  return (
    <div className="fade-up">
      <ScreenHead
        th="จัดการสินค้า"
        en={`Products · ${products.length} SKU`}
        right={
          <Btn kind="primary" icon="plus" size="sm" onClick={() => setEditing("new")}>
            เพิ่มสินค้า
          </Btn>
        }
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <SelectInput value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 200 }}>
          <option value="all">ทุกหมวดหมู่</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectInput>
        <SearchBox value={q} onChange={setQ} placeholder="ค้นหา SKU / ชื่อสินค้า" />
      </div>
      <Panel pad={0}>
        <DataTable
          cols={[
            { label: "SKU", w: 120 },
            { label: "ชื่อสินค้า" },
            { label: "หมวดหมู่", w: 130 },
            { label: "หน่วย", w: 70 },
            { label: "ลำดับ", right: true, w: 70 },
            { label: "สถานะ", w: 90 },
            { label: "", w: 70 },
          ]}
        >
          {list.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid var(--surface-3)" }}>
              <td style={{ padding: "11px 14px" }}>
                <span className="mono" style={{ fontSize: 12.5 }}>
                  {p.sku}
                </span>
              </td>
              <td style={{ padding: "11px 14px", fontWeight: 600 }}>
                {p.name} <span className="en" style={{ fontSize: 11 }}>{p.name_en}</span>
              </td>
              <td style={{ padding: "11px 14px", color: "var(--ink-2)" }}>{catName(p.category_id)}</td>
              <td style={{ padding: "11px 14px", color: "var(--ink-3)" }}>{p.unit}</td>
              <td className="tnum" style={{ padding: "11px 14px", textAlign: "right", color: "var(--ink-3)" }}>
                {p.display_order}
              </td>
              <td style={{ padding: "11px 14px" }}>
                <span className={`pill ${p.active ? "green" : "grey"}`}>{p.active ? "ใช้งาน" : "ปิด"}</span>
              </td>
              <td style={{ padding: "11px 14px" }}>
                <button
                  onClick={() => setEditing(p)}
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
          {list.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: 28, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>
                ไม่พบสินค้า
              </td>
            </tr>
          )}
        </DataTable>
      </Panel>

      {editing && (
        <ProductModal
          editing={editing}
          categories={categories}
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

function ProductModal({
  editing,
  categories,
  onClose,
  onSaved,
}: {
  editing: Product | "new";
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = editing === "new";
  const p = isNew ? null : editing;
  const [sku, setSku] = useState(p?.sku ?? "");
  const [category, setCategory] = useState(p?.category_id ?? categories[0]?.id ?? "");
  const [name, setName] = useState(p?.name ?? "");
  const [nameEn, setNameEn] = useState(p?.name_en ?? "");
  const [unit, setUnit] = useState(p?.unit ?? "");
  const [min, setMin] = useState(String(p?.min_stock ?? ""));
  const [order, setOrder] = useState(String(p?.display_order ?? ""));
  const [size, setSize] = useState(p?.size ?? "");
  const [length, setLength] = useState(p?.length ?? "");
  const [active, setActive] = useState(isNew ? true : p!.active);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setError(null);
    const input: ProductInput = {
      id: isNew ? undefined : p!.id,
      sku,
      name,
      name_en: nameEn,
      category_id: category,
      unit,
      size,
      length,
      min_stock: Number(min) || 0,
      display_order: Number(order) || 0,
      active,
    };
    start(async () => {
      const res = await saveProduct(input);
      if (res.ok) onSaved();
      else setError(res.error || "บันทึกไม่สำเร็จ");
    });
  };

  const remove = () => {
    if (isNew) return;
    setError(null);
    start(async () => {
      const res = await deleteProduct(p!.id);
      if (res.ok) onSaved();
      else setError(res.error || "ลบไม่สำเร็จ");
    });
  };

  return (
    <Modal
      title={isNew ? "เพิ่มสินค้าใหม่" : "แก้ไขสินค้า"}
      en={isNew ? "New product" : p!.sku}
      onClose={onClose}
      width={520}
      footer={
        <>
          {!isNew && (
            <Btn kind="danger" icon="trash" onClick={remove} disabled={pending} style={{ marginRight: "auto" }}>
              ลบ
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
        <Field label="SKU" en="Unique code">
          <TextInput value={sku} onChange={(e) => setSku(e.target.value)} placeholder="RAIL-1-1M" />
        </Field>
        <Field label="หมวดหมู่" en="Category">
          <SelectInput value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
      <Field label="ชื่อสินค้า" en="Product name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="รางเหล็ก 1 นิ้ว 1 เมตร" />
      </Field>
      <Field label="ชื่อสินค้า (อังกฤษ)" en="Name (English)">
        <TextInput value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Steel Rail 1&quot; 1m" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <Field label="หน่วยนับ" en="Unit">
          <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="เส้น" />
        </Field>
        <Field label="สต็อกขั้นต่ำ" en="Min level">
          <TextInput inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} placeholder="60" />
        </Field>
        <Field label="ลำดับแสดง" en="Order">
          <TextInput inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value.replace(/\D/g, ""))} placeholder="1" />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="ขนาด (ถ้ามี)" en="Size · optional">
          <TextInput value={size} onChange={(e) => setSize(e.target.value)} placeholder={'1"'} />
        </Field>
        <Field label="ความยาว (ถ้ามี)" en="Length · optional">
          <TextInput value={length} onChange={(e) => setLength(e.target.value)} placeholder="1m" />
        </Field>
      </div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          borderRadius: 10,
          background: "var(--surface-2)",
          marginTop: 4,
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>
          เปิดใช้งานสินค้า <span className="en">Active</span>
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
