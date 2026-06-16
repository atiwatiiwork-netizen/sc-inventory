"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Btn, Field, Modal, Panel, ScreenHead, SelectInput, TextInput } from "@/components/ui";
import {
  STATUS_META,
  SOURCE_TH,
  TICKET_STATUSES,
  CATEGORY_TH,
  categoryOfKind,
  urgencyBadge,
  timingLabel,
  suggestRefill,
  type ProductionTicket,
  type ProductCategory,
  type TicketDraft,
  type TicketProductKind,
  type TicketStatus,
  type TimingKind,
} from "@/lib/wheels/ticket";
import { createTicket, setTicketStatus, sendLineForTicket } from "@/app/admin/(console)/wheels/tickets/actions";

export type PickProduct = { kind: TicketProductKind; id: string; sku: string; name: string; unit: string; stock: number; minStock: number };

export function TicketsClient({ tickets, products, lineReady }: { tickets: ProductionTicket[]; products: PickProduct[]; lineReady: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [catFilter, setCatFilter] = useState<"all" | ProductCategory>("all");

  const openCount = tickets.filter((t) => t.status === "open" || t.status === "in_review").length;
  const shown = useMemo(
    () =>
      tickets
        .filter((t) => (filter === "open" ? t.status === "open" || t.status === "in_review" : true))
        .filter((t) => catFilter === "all" || categoryOfKind(t.product_kind) === catFilter),
    [tickets, filter, catFilter],
  );

  return (
    <div className="fade-up">
      <ScreenHead
        th="ตั๋วสั่งผลิต"
        en="Production Tickets · คำขอให้พิจารณา"
        right={
          products.length > 0 ? (
            <Btn kind="primary" icon="plus" size="sm" onClick={() => setCreating(true)}>
              ออกตั๋วสั่งผลิต
            </Btn>
          ) : undefined
        }
      />
      <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 16, maxWidth: 760 }}>
        คำขอให้ผลิตเติม (จากการเช็คสต็อก หรือสร้างเอง) สำหรับให้คนพิจารณา · ไม่ใช่คำสั่งผลิตอัตโนมัติ · ไม่ตัดสต็อกและไม่ผูกกับแผนงาน
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <Btn kind={filter === "open" ? "primary" : "default"} size="sm" onClick={() => setFilter("open")}>
          ที่ต้องดำเนินการ ({openCount})
        </Btn>
        <Btn kind={filter === "all" ? "primary" : "default"} size="sm" onClick={() => setFilter("all")}>
          ทั้งหมด ({tickets.length})
        </Btn>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {(["all", "wheel", "assembly"] as const).map((c) => (
          <Btn key={c} kind={catFilter === c ? "primary" : "default"} size="sm" onClick={() => setCatFilter(c)}>
            {c === "all" ? "ทุกประเภท" : CATEGORY_TH[c]}
          </Btn>
        ))}
      </div>

      <Panel pad={0}>
        {shown.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>ยังไม่มีตั๋วสั่งผลิต</div>
        ) : (
          shown.map((t, i) => <TicketRow key={t.id} t={t} last={i === shown.length - 1} lineReady={lineReady} onChanged={() => router.refresh()} />)
        )}
      </Panel>

      {creating && (
        <CreateModal
          products={products}
          lineReady={lineReady}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TicketRow({ t, last, lineReady, onChanged }: { t: ProductionTicket; last: boolean; lineReady: boolean; onChanged: () => void }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const meta = STATUS_META[t.status];
  const muted = t.status === "cancelled" || t.status === "rejected" || t.status === "done";

  const change = (status: TicketStatus) => start(async () => { await setTicketStatus(t.id, status); onChanged(); });
  const line = () => start(async () => {
    const r = await sendLineForTicket(t.id);
    setMsg(r.ok ? "ส่ง LINE แล้ว" : r.error || "ส่ง LINE ไม่สำเร็จ");
  });

  const urg = urgencyBadge(t);
  const shortage = t.requested_qty - t.current_stock;

  return (
    <div style={{ padding: "14px 16px", borderBottom: last ? "none" : "1px solid var(--surface-3)", opacity: muted ? 0.65 : 1, borderLeft: !muted && urg.urgent ? "4px solid var(--amber-ink)" : undefined }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t.display_name} <span className="en" style={{ fontSize: 11 }}>{CATEGORY_TH[categoryOfKind(t.product_kind)]}</span></div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>
            {t.sku} · {SOURCE_TH[t.source]} · {t.ticket_date}{t.created_by ? ` · ${t.created_by}` : ""}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 6, display: "flex", flexWrap: "wrap", gap: "2px 14px" }}>
            <span>สต็อกตอนออกตั๋ว: <b className="tnum">{t.current_stock.toLocaleString()}</b> / ขั้นต่ำ {t.min_stock.toLocaleString()} {t.unit}</span>
            <span>ลูกค้าขอ: <b className="tnum">{t.requested_qty.toLocaleString()}</b> {t.unit}</span>
            {t.source === "stock_check" && shortage > 0 && <span style={{ color: "var(--red-ink)", fontWeight: 600 }}>ขาด: {shortage.toLocaleString()} {t.unit}</span>}
            <span>ควรทำเติม: <b className="tnum" style={{ color: "var(--accent)" }}>{t.suggested_qty.toLocaleString()}</b> {t.unit}</span>
            <span>กำหนด: {timingLabel(t.timing_kind, t.timing_date, t.timing_hours)}</span>
          </div>
          {t.note ? <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>📝 {t.note}</div> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flex: "none" }}>
          <span className={`pill ${meta.pill}`}>{meta.th}</span>
          {!muted && <span className={`pill ${urg.pill}`} style={{ fontSize: 11 }}>{urg.label}</span>}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--ink-4)" }}>เปลี่ยนสถานะ:</span>
        <SelectInput value={t.status} disabled={pending} onChange={(e) => change(e.target.value as TicketStatus)} style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}>
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_META[s].th}</option>
          ))}
        </SelectInput>
        {lineReady && (
          <Btn kind="ghost" size="sm" icon="chat" onClick={line} disabled={pending}>ส่ง LINE</Btn>
        )}
        {msg && <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{msg}</span>}
      </div>
    </div>
  );
}

function CreateModal({ products, lineReady, onClose, onSaved }: { products: PickProduct[]; lineReady: boolean; onClose: () => void; onSaved: () => void }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [requested, setRequested] = useState("");
  const [suggested, setSuggested] = useState("");
  const [timing, setTiming] = useState<TimingKind>("today");
  const [timingDate, setTimingDate] = useState("");
  const [timingHours, setTimingHours] = useState("");
  const [note, setNote] = useState("");
  const [sendLine, setSendLine] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [touchedSuggest, setTouchedSuggest] = useState(false);
  const [pending, start] = useTransition();

  const product = products.find((p) => p.id === productId) ?? null;
  const reqNum = Number(requested) || 0;
  // Informational starter suggestion; recomputed until the user edits it.
  const autoSuggest = product ? suggestRefill(product.stock, product.minStock, reqNum) : 0;
  const suggestVal = touchedSuggest ? suggested : String(autoSuggest);

  const save = () => {
    setError(null);
    setWarn(null);
    if (!product) return setError("กรุณาเลือกสินค้า");
    const draft: TicketDraft = {
      source: "manual",
      product_kind: product.kind,
      product_id: product.id,
      sku: product.sku,
      display_name: product.name,
      unit: product.unit,
      current_stock: product.stock,
      min_stock: product.minStock,
      requested_qty: reqNum,
      suggested_qty: Number(suggestVal) || 0,
      timing_kind: timing,
      timing_date: timing === "custom" ? timingDate || null : null,
      timing_hours: timing === "within_hours" ? Number(timingHours) || null : null,
      note,
    };
    start(async () => {
      const res = await createTicket(draft, sendLine && lineReady);
      if (!res.ok) return setError(res.error || "บันทึกไม่สำเร็จ");
      if (sendLine && res.lineSent === false) return setWarn(`บันทึกตั๋วแล้ว แต่ส่ง LINE ไม่สำเร็จ: ${res.lineError ?? ""}`);
      onSaved();
    });
  };

  return (
    <Modal
      title="ออกตั๋วสั่งผลิต"
      en="New ticket · manual"
      onClose={onClose}
      width={500}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose} disabled={pending}>ยกเลิก</Btn>
          <Btn kind="primary" icon="check" onClick={save} disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกตั๋ว"}</Btn>
        </>
      }
    >
      <Field label="สินค้า" en="Product">
        <SelectInput value={productId} onChange={(e) => setProductId(e.target.value)}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.kind === "box" ? "📦" : "🔧"} {p.name} · {p.sku} (มี {p.stock})</option>
          ))}
        </SelectInput>
      </Field>

      {product && (
        <div style={{ marginBottom: 14, fontSize: 12.5, color: "var(--ink-3)" }}>
          สต็อกปัจจุบัน <b className="tnum">{product.stock.toLocaleString()}</b> / ขั้นต่ำ {product.minStock.toLocaleString()} {product.unit}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="ลูกค้าขอ (ถ้ามี)" en="Requested">
          <TextInput inputMode="numeric" value={requested} onChange={(e) => setRequested(e.target.value.replace(/\D/g, ""))} placeholder="0" />
        </Field>
        <Field label="ควรทำเติมเบื้องต้น" en="Suggested · editable">
          <TextInput inputMode="numeric" value={suggestVal} onChange={(e) => { setTouchedSuggest(true); setSuggested(e.target.value.replace(/\D/g, "")); }} placeholder="0" />
        </Field>
      </div>

      <Field label="กำหนดเวลา" en="Desired timing">
        <SelectInput value={timing} onChange={(e) => setTiming(e.target.value as TimingKind)}>
          <option value="now">เดี๋ยวนี้</option>
          <option value="today">ภายในวันนี้</option>
          <option value="within_hours">ภายใน xx ชั่วโมง</option>
          <option value="custom">กำหนดวันเอง</option>
        </SelectInput>
      </Field>
      {timing === "within_hours" && (
        <Field label="ภายในกี่ชั่วโมง" en="Hours">
          <TextInput inputMode="numeric" value={timingHours} onChange={(e) => setTimingHours(e.target.value.replace(/\D/g, ""))} placeholder="เช่น 4" />
        </Field>
      )}
      {timing === "custom" && (
        <Field label="ภายในวันที่" en="Date">
          <TextInput type="date" value={timingDate} onChange={(e) => setTimingDate(e.target.value)} />
        </Field>
      )}

      <Field label="หมายเหตุ (ถ้ามี)" en="Note · optional">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ลูกค้าสั่งด่วน" />
      </Field>

      {lineReady && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
          <input type="checkbox" checked={sendLine} onChange={(e) => setSendLine(e.target.checked)} style={{ width: 17, height: 17 }} />
          แจ้งเตือนผ่าน LINE ด้วย
        </label>
      )}

      <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--ink-4)" }}>
        * ตั๋วเป็นคำขอให้พิจารณา ไม่ใช่คำสั่งผลิต · กำหนด: {timingLabel(timing, timingDate || null, Number(timingHours) || null)}
      </div>

      {warn && <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--amber-soft)", color: "var(--amber-ink)", fontSize: 13, fontWeight: 600 }}>{warn} <button onClick={onSaved} style={{ marginLeft: 8, textDecoration: "underline", border: "none", background: "none", color: "inherit", cursor: "pointer" }}>ปิด</button></div>}
      {error && <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>{error}</div>}
    </Modal>
  );
}
