"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Btn, Field, Modal, Panel, ScreenHead, SelectInput, TextInput } from "@/components/ui";
import { STATUS_META, type WorkPlanItem, type WorkPlanProductKind, type WorkPlanStatus } from "@/lib/wheels/work-plan";
import { saveWorkPlanItem, setWorkPlanStatus, addWorkPlanItemsBulk, type WorkPlanInput, type BulkPlanLine } from "@/app/admin/(console)/wheels/work-plan/actions";

/** Passive wooden-crate context for a SKU (Phase 6). Display only. */
export type CrateContext = { crates: number; piecesPerCrate: number; approxPieces: number };

/** A pickable finished good for a plan item, with passive stock/crate context. */
export type PlanProduct = {
  kind: WorkPlanProductKind;
  id: string;
  sku: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  crate: CrateContext | null;
};

/** A low-stock box for the picker (grouped Size → Groove on the server). */
export type LowStockItem = { product_id: string; sku: string; name: string; unit: string; stock: number; minStock: number; shortage: number };
export type LowStockGroove = { grooveId: string; grooveLabel: string; items: LowStockItem[] };
export type LowStockSize = { sizeId: string; sizeLabel: string; grooves: LowStockGroove[] };

type Editing = WorkPlanItem | "new" | null;

export function WorkPlanClient({
  items,
  products,
  lowStock,
  today,
  tomorrow,
}: {
  items: WorkPlanItem[];
  products: PlanProduct[];
  lowStock: LowStockSize[];
  today: string;
  tomorrow: string;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const [defaultDate, setDefaultDate] = useState(today);
  const [picker, setPicker] = useState(false);
  const router = useRouter();

  const lowStockCount = lowStock.reduce((s, sz) => s + sz.grooves.reduce((g, gr) => g + gr.items.length, 0), 0);

  const todayItems = useMemo(() => items.filter((i) => i.plan_date === today), [items, today]);
  const tomorrowItems = useMemo(() => items.filter((i) => i.plan_date === tomorrow), [items, tomorrow]);

  const openNew = (date: string) => {
    setDefaultDate(date);
    setEditing("new");
  };

  return (
    <div className="fade-up" style={{ maxWidth: 720, margin: "0 auto" }}>
      <ScreenHead
        th="แผนงานโรงงาน"
        en="Work Plan · งานที่โรงงานควรโฟกัส"
        right={
          products.length > 0 ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn kind="default" icon="alert" size="sm" onClick={() => setPicker(true)}>
                เลือกจากสต็อกต่ำ{lowStockCount > 0 ? ` (${lowStockCount})` : ""}
              </Btn>
              <Btn kind="primary" icon="plus" size="sm" onClick={() => openNew(today)}>
                เพิ่มแผนงาน
              </Btn>
            </div>
          ) : undefined
        }
      />
      <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 16 }}>
        เจ้าของ/แอดมินบันทึกว่าจะให้โรงงานโฟกัสอะไรวันนี้และพรุ่งนี้ · ออฟฟิศ คลัง และโรงงานเห็นแผนเดียวกัน
        (ดูอย่างเดียว · ไม่กระทบสต็อกหรือการผลิต)
      </div>

      {products.length === 0 && (
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", color: "var(--ink-3)", fontSize: 13 }}>
          ต้องมีกล่องบรรจุหรือสินค้าประกอบอย่างน้อย 1 รายการก่อน จึงจะสร้างแผนงานได้
        </div>
      )}

      <PlanSection
        label="วันนี้"
        en="Today"
        date={today}
        items={todayItems}
        onAdd={() => openNew(today)}
        onEdit={setEditing}
        canAdd={products.length > 0}
      />
      <div style={{ height: 18 }} />
      <PlanSection
        label="พรุ่งนี้"
        en="Tomorrow"
        date={tomorrow}
        items={tomorrowItems}
        onAdd={() => openNew(tomorrow)}
        onEdit={setEditing}
        canAdd={products.length > 0}
      />

      {editing && (
        <PlanModal
          editing={editing}
          products={products}
          today={today}
          tomorrow={tomorrow}
          defaultDate={defaultDate}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      {picker && (
        <LowStockPicker
          lowStock={lowStock}
          today={today}
          tomorrow={tomorrow}
          onClose={() => setPicker(false)}
          onSaved={() => {
            setPicker(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function PlanSection({
  label,
  en,
  date,
  items,
  onAdd,
  onEdit,
  canAdd,
}: {
  label: string;
  en: string;
  date: string;
  items: WorkPlanItem[];
  onAdd: () => void;
  onEdit: (i: WorkPlanItem) => void;
  canAdd: boolean;
}) {
  return (
    <Panel
      title={label}
      en={`${en} · ${date}`}
      right={
        canAdd ? (
          <button
            onClick={onAdd}
            className="focusable"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "transparent", color: "var(--accent)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            <Icon name="plus" size={15} /> เพิ่ม
          </button>
        ) : undefined
      }
      pad={0}
    >
      {items.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--ink-4)", fontSize: 13.5 }}>ยังไม่มีแผนงาน</div>
      ) : (
        items.map((it, idx) => <PlanRow key={it.id} item={it} last={idx === items.length - 1} onEdit={() => onEdit(it)} />)
      )}
    </Panel>
  );
}

function PlanRow({ item, last, onEdit }: { item: WorkPlanItem; last: boolean; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const meta = STATUS_META[item.status];
  const cancelled = item.status === "cancelled";

  const setStatus = (status: WorkPlanStatus) =>
    start(async () => {
      await setWorkPlanStatus(item.id, status);
      router.refresh();
    });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 16px",
        borderBottom: last ? "none" : "1px solid var(--surface-3)",
        opacity: cancelled ? 0.55 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, textDecoration: cancelled ? "line-through" : "none" }}>
          {item.display_name}
          <span className="tnum" style={{ marginLeft: 8, fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
            {item.quantity.toLocaleString()} <span style={{ fontWeight: 500, color: "var(--ink-3)", fontSize: 12 }}>{item.unit}</span>
          </span>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>{item.sku}</div>
        {item.note ? <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>📝 {item.note}</div> : null}

        {/* Quick status actions (admin/owner) — no automatic status changes. */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {item.status === "planned" && (
            <QuickBtn label="เริ่มทำ" icon="bolt" onClick={() => setStatus("in_progress")} disabled={pending} />
          )}
          {(item.status === "planned" || item.status === "in_progress") && (
            <QuickBtn label="เสร็จ" icon="check" onClick={() => setStatus("done")} disabled={pending} />
          )}
          {!cancelled && <QuickBtn label="ยกเลิก" icon="x" onClick={() => setStatus("cancelled")} disabled={pending} danger />}
          {cancelled && <QuickBtn label="เปิดอีกครั้ง" icon="download" onClick={() => setStatus("planned")} disabled={pending} />}
          <QuickBtn label="แก้ไข" icon="edit" onClick={onEdit} disabled={pending} />
        </div>
      </div>
      <span className={`pill ${meta.pill}`} style={{ flex: "none" }}>{meta.th}</span>
    </div>
  );
}

function QuickBtn({
  label,
  icon,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  icon: "bolt" | "check" | "x" | "edit" | "download";
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="focusable"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "5px 10px",
        borderRadius: 8,
        border: "1px solid var(--border-2)",
        background: "var(--surface)",
        color: danger ? "var(--red-ink)" : "var(--ink-2)",
        fontSize: 12.5,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <Icon name={icon} size={13} /> {label}
    </button>
  );
}

function PlanModal({
  editing,
  products,
  today,
  tomorrow,
  defaultDate,
  onClose,
  onSaved,
}: {
  editing: WorkPlanItem | "new";
  products: PlanProduct[];
  today: string;
  tomorrow: string;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = editing === "new";
  const it = isNew ? null : editing;

  const [planDate, setPlanDate] = useState(it?.plan_date ?? defaultDate);
  const [productId, setProductId] = useState(it?.product_id ?? products[0]?.id ?? "");
  const [qty, setQty] = useState(String(it?.quantity ?? ""));
  const [unit, setUnit] = useState(it?.unit ?? products[0]?.unit ?? "");
  const [note, setNote] = useState(it?.note ?? "");
  const [status, setStatus] = useState<WorkPlanStatus>(it?.status ?? "planned");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const product = products.find((p) => p.id === productId) ?? null;

  // When picking a product, default the unit to that product's unit.
  const pickProduct = (id: string) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) setUnit(p.unit);
  };

  const save = () => {
    setError(null);
    if (!product) return setError("กรุณาเลือกสินค้า");
    const input: WorkPlanInput = {
      id: isNew ? undefined : it!.id,
      plan_date: planDate,
      product_kind: product.kind,
      product_id: product.id,
      sku: product.sku,
      display_name: product.name,
      quantity: Number(qty) || 0,
      unit,
      note,
      status: isNew ? undefined : status,
    };
    start(async () => {
      const res = await saveWorkPlanItem(input);
      if (res.ok) onSaved();
      else setError(res.error || "บันทึกไม่สำเร็จ");
    });
  };

  return (
    <Modal
      title={isNew ? "เพิ่มแผนงาน" : "แก้ไขแผนงาน"}
      en={isNew ? "New plan item" : it!.sku}
      onClose={onClose}
      width={500}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose} disabled={pending}>ยกเลิก</Btn>
          <Btn kind="primary" icon="check" onClick={save} disabled={pending}>
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </Btn>
        </>
      }
    >
      <Field label="วันที่" en="Plan date">
        <SelectInput value={planDate} onChange={(e) => setPlanDate(e.target.value)}>
          <option value={today}>วันนี้ · Today ({today})</option>
          <option value={tomorrow}>พรุ่งนี้ · Tomorrow ({tomorrow})</option>
        </SelectInput>
      </Field>

      <Field label="สินค้า" en="Product (box / assembly)">
        <SelectInput value={productId} onChange={(e) => pickProduct(e.target.value)}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.kind === "box" ? "📦" : "🔧"} {p.name} · {p.sku}
            </option>
          ))}
        </SelectInput>
      </Field>

      {product && <ProductContext product={product} />}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="จำนวน" en="Quantity">
          <TextInput inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder="20" />
        </Field>
        <Field label="หน่วย" en="Unit">
          <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ลัง" />
        </Field>
      </div>

      <Field label="หมายเหตุ (ถ้ามี)" en="Note · optional">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ลูกค้าสั่งด่วน" />
      </Field>

      {!isNew && (
        <Field label="สถานะ" en="Status">
          <SelectInput value={status} onChange={(e) => setStatus(e.target.value as WorkPlanStatus)}>
            {(Object.keys(STATUS_META) as WorkPlanStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].th} · {STATUS_META[s].en}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}

      {error && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}
    </Modal>
  );
}

/**
 * Passive context for the selected SKU (Phase 6). Shows reality — current/min
 * stock, current shortage, and wooden-crate availability — so the human can
 * decide. NO recommendations, NO suggested quantity, NO blocking.
 */
function ProductContext({ product }: { product: PlanProduct }) {
  const shortage = Math.max(0, product.minStock - product.stock);
  const low = product.minStock > 0 && product.stock < product.minStock;
  return (
    <div style={{ margin: "0 0 14px", padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", marginBottom: 8 }}>
        ข้อมูลประกอบการตัดสินใจ <span className="en" style={{ fontSize: 10 }}>· for reference only</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px", fontSize: 13 }}>
        <Ctx label="สต็อกปัจจุบัน" value={`${product.stock.toLocaleString()} ${product.unit}`} />
        <Ctx label="สต็อกขั้นต่ำ" value={`${product.minStock.toLocaleString()} ${product.unit}`} />
        <Ctx label="ขาดอยู่" value={shortage > 0 ? `${shortage.toLocaleString()} ${product.unit}` : "—"} accent={low ? "var(--red-ink)" : undefined} />
      </div>
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--border-2)", display: "flex", flexWrap: "wrap", gap: "8px 18px", fontSize: 13 }}>
        {product.kind === "box" && product.crate ? (
          <>
            <Ctx label="ลังไม้คงเหลือ" value={`${product.crate.crates.toLocaleString()} ลัง`} />
            <Ctx label="≈ ล้อดิบในลัง" value={`~${product.crate.approxPieces.toLocaleString()} ลูก`} />
            <span style={{ fontSize: 11.5, color: "var(--ink-4)" }}>(ลังละ ~{product.crate.piecesPerCrate.toLocaleString()} ลูก)</span>
          </>
        ) : (
          <span style={{ fontSize: 12, color: "var(--ink-4)" }}>
            {product.kind === "box" ? "ยังไม่มีข้อมูลลังไม้ของล้อดิบนี้" : "สินค้าประกอบ — ไม่มีข้อมูลลังไม้"}
          </span>
        )}
      </div>
    </div>
  );
}

function Ctx({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <span>
      <span style={{ color: "var(--ink-3)" }}>{label}: </span>
      <span className="tnum" style={{ fontWeight: 700, color: accent ?? "var(--ink)" }}>{value}</span>
    </span>
  );
}

/**
 * Feature 1 — Low Stock SKU picker. PASSIVE list of boxes below minimum, grouped
 * Size → Groove. The human checks which SKUs to add and types each quantity; the
 * system NEVER auto-selects, ranks, suggests, or generates quantities.
 */
function LowStockPicker({
  lowStock,
  today,
  tomorrow,
  onClose,
  onSaved,
}: {
  lowStock: LowStockSize[];
  today: string;
  tomorrow: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [planDate, setPlanDate] = useState(today);
  const [qtyById, setQtyById] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const flat = lowStock.flatMap((s) => s.grooves.flatMap((g) => g.items));
  const byId = new Map(flat.map((i) => [i.product_id, i]));
  const selectedCount = Object.values(checked).filter(Boolean).length;

  const toggle = (id: string) => setChecked((c) => ({ ...c, [id]: !c[id] }));
  const setQty = (id: string, v: string) => setQtyById((q) => ({ ...q, [id]: v.replace(/\D/g, "") }));

  const add = () => {
    setError(null);
    const lines: BulkPlanLine[] = Object.keys(checked)
      .filter((id) => checked[id])
      .map((id) => {
        const it = byId.get(id)!;
        return {
          product_kind: "box" as const,
          product_id: it.product_id,
          sku: it.sku,
          display_name: it.name,
          quantity: Number(qtyById[id]) || 0,
          unit: it.unit,
        };
      });
    if (lines.length === 0) return setError("กรุณาเลือกอย่างน้อย 1 รายการ");
    if (lines.some((l) => !(l.quantity > 0))) return setError("กรุณากรอกจำนวนของรายการที่เลือกให้ครบ");
    start(async () => {
      const res = await addWorkPlanItemsBulk(planDate, lines);
      if (res.ok) onSaved();
      else setError(res.error || "เพิ่มไม่สำเร็จ");
    });
  };

  return (
    <Modal
      title="เลือกจากสต็อกต่ำ"
      en="Low stock · pick SKUs to plan"
      onClose={onClose}
      width={580}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose} disabled={pending}>ยกเลิก</Btn>
          <Btn kind="primary" icon="plus" onClick={add} disabled={pending || selectedCount === 0}>
            {pending ? "กำลังเพิ่ม…" : `เพิ่มเข้าแผน${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
          </Btn>
        </>
      }
    >
      <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 12 }}>
        รายการที่ต่ำกว่าสต็อกขั้นต่ำ · เลือกเองและกรอกจำนวนเอง (ระบบไม่แนะนำหรือคำนวณจำนวนให้)
      </div>

      <div style={{ marginBottom: 14 }}>
        <Field label="ใส่เข้าแผนวันที่" en="Plan date">
          <SelectInput value={planDate} onChange={(e) => setPlanDate(e.target.value)}>
            <option value={today}>วันนี้ · Today ({today})</option>
            <option value={tomorrow}>พรุ่งนี้ · Tomorrow ({tomorrow})</option>
          </SelectInput>
        </Field>
      </div>

      {flat.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>
          ไม่มีสินค้าที่ต่ำกว่าสต็อกขั้นต่ำ 🎉
        </div>
      ) : (
        lowStock.map((sz) => (
          <div key={sz.sizeId} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>ขนาด {sz.sizeLabel}</div>
            {sz.grooves.map((gr) => (
              <div key={gr.grooveId} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)", padding: "2px 0" }}>ร่อง {gr.grooveLabel}</div>
                {gr.items.map((it) => {
                  const on = !!checked[it.product_id];
                  return (
                    <div
                      key={it.product_id}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 9, background: on ? "var(--accent-soft)" : "transparent", border: "1px solid var(--surface-3)", marginBottom: 5 }}
                    >
                      <input type="checkbox" checked={on} onChange={() => toggle(it.product_id)} style={{ width: 17, height: 17, flex: "none" }} />
                      <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => toggle(it.product_id)}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{it.name}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-4)" }}>
                          มี {it.stock.toLocaleString()} / ขั้นต่ำ {it.minStock.toLocaleString()} ·{" "}
                          <span style={{ color: "var(--red-ink)", fontWeight: 600 }}>ขาด {it.shortage.toLocaleString()} {it.unit}</span>
                        </div>
                      </div>
                      <TextInput
                        inputMode="numeric"
                        value={qtyById[it.product_id] ?? ""}
                        onChange={(e) => setQty(it.product_id, e.target.value)}
                        placeholder="จำนวน"
                        disabled={!on}
                        style={{ width: 90, flex: "none", opacity: on ? 1 : 0.5 }}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))
      )}

      {error && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}
    </Modal>
  );
}
