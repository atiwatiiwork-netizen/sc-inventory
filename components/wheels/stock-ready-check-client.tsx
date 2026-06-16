"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Btn, Field, Modal, Panel, ScreenHead, SearchBox, SelectInput, TextInput } from "@/components/ui";
import {
  evaluateAvailability,
  AVAILABILITY_META,
  suggestRefill,
  timingLabel,
  type Availability,
  type TimingKind,
  type TicketDraft,
} from "@/lib/wheels/ticket";
export type ReadyItem = {
  productId: string;
  sku: string;
  name: string; // Thai name (shown bold on top)
  nameEn: string; // English name (shown as the secondary line)
  note: string | null;
  unit: string;
  stock: number;
  minStock: number;
  plannedQty: number; // Work Plan today+tomorrow (non-cancelled)
  crate: { crates: number; approxPieces: number } | null;
};

/** Server actions supplied by the page (worker- or admin-side), so the same UI
 *  works on both with the correct identity + RBAC enforced server-side. */
export type CreateTicketFn = (draft: TicketDraft, sendLine: boolean) => Promise<{ ok: boolean; error?: string; lineSent?: boolean; lineError?: string }>;
export type NotifyLineFn = (draft: TicketDraft) => Promise<{ ok: boolean; error?: string }>;

/**
 * Stock Ready Check — search a finished good, enter a requested quantity, and see
 * a simple Green/Yellow/Red availability result. Passive decision support: it
 * never reserves or deducts stock. On Yellow/Red, permitted users may optionally
 * raise a production ticket or send a LINE alert (manual click only).
 */
export function StockReadyCheckClient({
  items,
  canCreateTicket,
  lineReady,
  onCreateTicket,
  onNotifyLine,
}: {
  items: ReadyItem[];
  canCreateTicket: boolean;
  lineReady: boolean;
  onCreateTicket: CreateTicketFn;
  onNotifyLine: NotifyLineFn;
}) {
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(null);

  const selected = useMemo(() => items.find((i) => i.productId === selId) ?? null, [items, selId]);
  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((i) => i.sku.toLowerCase().includes(query) || i.name.toLowerCase().includes(query) || i.nameEn.toLowerCase().includes(query) || (i.note ?? "").toLowerCase().includes(query));
  }, [items, q]);

  return (
    <div className="fade-up" style={{ maxWidth: 620, margin: "0 auto", padding: "4px 0" }}>
      <ScreenHead th="เช็คสต็อกพร้อมขาย" en="Stock Ready Check · เช็คให้ลูกค้า" />
      <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 14 }}>
        ค้นหาสินค้า เลือกรายการ แล้วใส่จำนวนที่ลูกค้าต้องการ เพื่อดูว่ามีของพอหรือไม่ (ดูอย่างเดียว · ไม่ตัดสต็อก)
      </div>

      <div style={{ marginBottom: 14 }}>
        <SearchBox value={q} onChange={setQ} placeholder="ค้นหา SKU / ชื่อสินค้า" />
      </div>

      {selected ? (
        <CheckDetail item={selected} canCreateTicket={canCreateTicket} lineReady={lineReady} onCreateTicket={onCreateTicket} onNotifyLine={onNotifyLine} onClear={() => setSelId(null)} />
      ) : (
        <Panel pad={0}>
          {matches.map((i) => (
            <button
              key={i.productId}
              onClick={() => {
                setSelId(i.productId);
                setQ("");
              }}
              className="focusable"
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "14px 16px", border: "none", borderBottom: "1px solid var(--surface-3)", background: "transparent", cursor: "pointer", color: "var(--ink)" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{i.name}</div>
                <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>
                  {i.nameEn && <span className="en">{i.nameEn}</span>}
                  <span className="mono" style={{ marginLeft: i.nameEn ? 6 : 0 }}>· {i.sku}</span>
                </div>
              </div>
              <div className="tnum" style={{ textAlign: "right", flex: "none", fontWeight: 700 }}>
                {i.stock.toLocaleString()} <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink-3)" }}>{i.unit}</span>
              </div>
              <Icon name="chevR" size={16} style={{ color: "var(--ink-4)", flex: "none" }} />
            </button>
          ))}
          {matches.length === 0 && (
            <div style={{ padding: 26, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>
              {items.length === 0 ? "ยังไม่มีสินค้าสำเร็จรูป" : "ไม่พบรายการที่ค้นหา"}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function CheckDetail({ item, canCreateTicket, lineReady, onCreateTicket, onNotifyLine, onClear }: { item: ReadyItem; canCreateTicket: boolean; lineReady: boolean; onCreateTicket: CreateTicketFn; onNotifyLine: NotifyLineFn; onClear: () => void }) {
  const [qtyStr, setQtyStr] = useState("");
  const [ticketOpen, setTicketOpen] = useState(false);
  const [lineMsg, setLineMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const requested = Number(qtyStr) || 0;
  const result: Availability | null = requested > 0 ? evaluateAvailability(item.stock, item.minStock, requested) : null;
  const remaining = item.stock - requested;
  const suggested = suggestRefill(item.stock, item.minStock, requested);

  const draft: TicketDraft = {
    source: "stock_check",
    product_kind: "box",
    product_id: item.productId,
    sku: item.sku,
    display_name: item.name,
    unit: item.unit,
    current_stock: item.stock,
    min_stock: item.minStock,
    requested_qty: requested,
    suggested_qty: suggested,
    timing_kind: "now",
    timing_date: null,
    timing_hours: null,
    note: "",
  };

  const sendLine = () => {
    setLineMsg(null);
    start(async () => {
      const r = await onNotifyLine(draft);
      setLineMsg(r.ok ? "ส่ง LINE แจ้งเตือนแล้ว" : r.error || "ส่ง LINE ไม่สำเร็จ");
    });
  };

  return (
    <div className="fade-up">
      <button onClick={onClear} className="focusable" style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: "var(--accent)", fontWeight: 600, fontSize: 13.5, cursor: "pointer", marginBottom: 12, padding: 0 }}>
        <Icon name="chevR" size={15} style={{ transform: "rotate(180deg)" }} /> เลือกสินค้าอื่น
      </button>

      <Panel pad={18} style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{item.name}</div>
        <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>
          {item.nameEn && <span className="en">{item.nameEn}</span>}
          <span className="mono" style={{ marginLeft: item.nameEn ? 6 : 0 }}>· {item.sku}</span>
          {item.note ? <span style={{ marginLeft: 6 }}>· {item.note}</span> : null}
        </div>

        <div style={{ marginTop: 16 }}>
          <Field label="จำนวนที่ลูกค้าต้องการ" en="Requested quantity">
            <TextInput inputMode="numeric" value={qtyStr} onChange={(e) => setQtyStr(e.target.value.replace(/\D/g, ""))} placeholder={`เช่น 20 ${item.unit}`} style={{ fontSize: 18, fontWeight: 700 }} />
          </Field>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 13, marginTop: 4 }}>
          <Row label="สต็อกปัจจุบัน" value={`${item.stock.toLocaleString()} ${item.unit}`} />
          <Row label="สต็อกขั้นต่ำ" value={`${item.minStock.toLocaleString()} ${item.unit}`} />
          {requested > 0 && <Row label="คงเหลือหลังขาย" value={`${remaining.toLocaleString()} ${item.unit}`} accent={remaining < 0 ? "var(--red-ink)" : remaining < item.minStock ? "var(--amber-ink)" : undefined} />}
          {item.plannedQty > 0 && <Row label="อยู่ในแผนผลิต" value={`${item.plannedQty.toLocaleString()} ${item.unit}`} />}
          {item.crate && <Row label="ลังไม้" value={`${item.crate.crates.toLocaleString()} ลัง (~${item.crate.approxPieces.toLocaleString()} ลูก)`} />}
        </div>
      </Panel>

      {result && <ResultBanner result={result} />}

      {result && result !== "green" && (
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          {canCreateTicket && (
            <Btn kind="primary" icon="bolt" onClick={() => setTicketOpen(true)} disabled={pending}>ออกตั๋วสั่งผลิต</Btn>
          )}
          {canCreateTicket && lineReady && (
            <Btn kind="default" icon="chat" onClick={sendLine} disabled={pending}>{pending ? "กำลังส่ง…" : "ส่ง LINE แจ้งเตือน"}</Btn>
          )}
          {!canCreateTicket && (
            <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>* การออกตั๋ว/แจ้งเตือนต้องได้รับสิทธิ์จากผู้ดูแล</div>
          )}
        </div>
      )}

      {lineMsg && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)", color: "var(--ink-2)", fontSize: 13, fontWeight: 600 }}>{lineMsg}</div>
      )}

      {ticketOpen && (
        <TicketModal
          draft={draft}
          lineReady={lineReady}
          onCreateTicket={onCreateTicket}
          onClose={() => setTicketOpen(false)}
          onSaved={() => {
            setTicketOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ResultBanner({ result }: { result: Availability }) {
  const meta = AVAILABILITY_META[result];
  const bg = result === "green" ? "var(--green-soft)" : result === "yellow" ? "var(--amber-soft)" : "var(--red-soft)";
  const icon = result === "green" ? "check" : "alert";
  return (
    <div className="pop-in" style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderRadius: 14, background: bg, color: meta.color }}>
      <span style={{ width: 40, height: 40, borderRadius: 999, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <Icon name={icon} size={22} />
      </span>
      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{meta.th}</div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <span>
      <span style={{ color: "var(--ink-3)" }}>{label}: </span>
      <span className="tnum" style={{ fontWeight: 700, color: accent ?? "var(--ink)" }}>{value}</span>
    </span>
  );
}

function TicketModal({ draft, lineReady, onCreateTicket, onClose, onSaved }: { draft: TicketDraft; lineReady: boolean; onCreateTicket: CreateTicketFn; onClose: () => void; onSaved: () => void }) {
  const [suggested, setSuggested] = useState(String(draft.suggested_qty));
  const [timing, setTiming] = useState<TimingKind>("now");
  const [timingDate, setTimingDate] = useState("");
  const [timingHours, setTimingHours] = useState("");
  const [note, setNote] = useState("");
  const [sendLine, setSendLine] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setError(null);
    setWarn(null);
    const full: TicketDraft = {
      ...draft,
      suggested_qty: Number(suggested) || 0,
      timing_kind: timing,
      timing_date: timing === "custom" ? timingDate || null : null,
      timing_hours: timing === "within_hours" ? Number(timingHours) || null : null,
      note,
    };
    start(async () => {
      const res = await onCreateTicket(full, sendLine && lineReady);
      if (!res.ok) return setError(res.error || "บันทึกไม่สำเร็จ");
      if (sendLine && res.lineSent === false) {
        setWarn(`บันทึกตั๋วแล้ว แต่ส่ง LINE ไม่สำเร็จ: ${res.lineError ?? ""}`);
        return;
      }
      onSaved();
    });
  };

  return (
    <Modal
      title="ออกตั๋วสั่งผลิต"
      en={draft.sku}
      onClose={onClose}
      width={500}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose} disabled={pending}>ยกเลิก</Btn>
          <Btn kind="primary" icon="check" onClick={save} disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกตั๋ว"}</Btn>
        </>
      }
    >
      <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)", fontSize: 13 }}>
        <div style={{ fontWeight: 700 }}>{draft.display_name}</div>
        <div style={{ color: "var(--ink-3)", marginTop: 3 }}>
          สต็อก {draft.current_stock.toLocaleString()} / ขั้นต่ำ {draft.min_stock.toLocaleString()} · ลูกค้าขอ {draft.requested_qty.toLocaleString()} {draft.unit}
        </div>
      </div>

      <Field label="จำนวนที่ควรทำเติมเบื้องต้น" en="Suggested refill · editable">
        <TextInput inputMode="numeric" value={suggested} onChange={(e) => setSuggested(e.target.value.replace(/\D/g, ""))} placeholder="0" />
      </Field>

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
        * ตั๋วนี้เป็นคำขอให้คนพิจารณา ไม่ใช่คำสั่งผลิตอัตโนมัติ · กำหนด: {timingLabel(timing, timingDate || null, Number(timingHours) || null)}
      </div>

      {warn && <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--amber-soft)", color: "var(--amber-ink)", fontSize: 13, fontWeight: 600 }}>{warn} <button onClick={onSaved} style={{ marginLeft: 8, textDecoration: "underline", border: "none", background: "none", color: "inherit", cursor: "pointer" }}>ปิด</button></div>}
      {error && <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>{error}</div>}
    </Modal>
  );
}
