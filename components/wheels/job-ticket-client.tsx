"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Btn, ScreenHead } from "@/components/ui";
import {
  WORK_STATUS_META,
  CATEGORY_TH,
  urgencyKey,
  isUrgent,
  formatDuration,
  timingLabel,
  type ProductCategory,
  type TimingKind,
  type WorkStatus,
} from "@/lib/wheels/ticket";
import { startJob, finishJob, startJobs, finishJobs } from "@/app/worker/(secure)/wheels/actions";

export type JobCard = {
  id: string;
  productId: string;
  name: string;
  category: ProductCategory;
  quantity: number;
  unit: string;
  createdAt: string;
  createdBy: string | null;
  timingKind: TimingKind;
  timingDate: string | null;
  timingHours: number | null;
  workStatus: WorkStatus;
  startedAt: string | null;
  startedBy: string | null;
  finishedAt: string | null;
  finishedBy: string | null;
  note: string | null;
};

const BKK = "Asia/Bangkok";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: BKK });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: BKK });
const dateOf = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: BKK });
const whenLabel = (iso: string) => (dayKey(iso) === dayKey(new Date().toISOString()) ? `วันนี้ ${timeOf(iso)}` : `${dateOf(iso)} ${timeOf(iso)}`);

const CATEGORY_ORDER: ProductCategory[] = ["wheel", "assembly"];
const STATUS_ORDER: WorkStatus[] = ["waiting", "in_progress", "done"];
const jobTiming = (c: JobCard) => ({ timing_kind: c.timingKind, timing_date: c.timingDate, timing_hours: c.timingHours });

/** A same-product display group (DB rows stay separate — aggregation is UI only). */
type Group = { key: string; status: WorkStatus; name: string; unit: string; total: number; tickets: JobCard[] };

export function JobTicketClient({ cards, lineReady }: { cards: JobCard[]; lineReady: boolean }) {
  const grouped = useMemo(() => {
    const byCat = new Map<ProductCategory, Map<WorkStatus, Group[]>>();
    for (const cat of CATEGORY_ORDER) byCat.set(cat, new Map(STATUS_ORDER.map((s) => [s, [] as Group[]])));

    for (const cat of CATEGORY_ORDER) {
      for (const st of STATUS_ORDER) {
        const list = cards.filter((c) => c.category === cat && c.workStatus === st);
        // Group by product_id + unit (category + status already fixed here).
        const map = new Map<string, Group>();
        for (const c of list) {
          const key = `${c.productId}__${c.unit}`;
          const g = map.get(key) ?? { key, status: st, name: c.name, unit: c.unit, total: 0, tickets: [] };
          g.tickets.push(c);
          g.total += c.quantity;
          map.set(key, g);
        }
        const groups = [...map.values()];
        for (const g of groups) sortTickets(g.tickets, st);
        sortGroups(groups, st);
        byCat.get(cat)!.set(st, groups);
      }
    }
    return byCat;
  }, [cards]);

  return (
    <div className="fade-up" style={{ maxWidth: 680, margin: "0 auto" }}>
      <ScreenHead th="ตั๋วสั่งงาน" en="Job Tickets · งานที่สั่งเข้าโรงงาน" />
      <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 6 }}>
        งานที่ถูกสั่งเข้ามาจากออฟฟิศหรือหัวหน้างาน · รายการสินค้าเดียวกันจะรวมแสดงเป็นการ์ดเดียว (แต่ละตั๋วยังแยกกันในระบบ)
      </div>
      {!lineReady && (
        <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginBottom: 14 }}>* ยังไม่ได้ตั้งค่า LINE — การแจ้งเตือนจะถูกข้าม (อัปเดตสถานะได้ตามปกติ)</div>
      )}

      {cards.length === 0 && (
        <div className="card" style={{ padding: 22, color: "var(--ink-3)", fontSize: 14, textAlign: "center" }}>ยังไม่มีงานที่ถูกสั่งเข้ามา</div>
      )}

      {CATEGORY_ORDER.map((cat) => {
        const m = grouped.get(cat)!;
        const total = STATUS_ORDER.reduce((s, st) => s + m.get(st)!.length, 0);
        if (total === 0) return null;
        return (
          <section key={cat} style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: "8px 0 12px", letterSpacing: "-.01em" }}>{CATEGORY_TH[cat]}</h2>
            {STATUS_ORDER.map((st) => {
              const groups = m.get(st)!;
              if (groups.length === 0) return null;
              return (
                <div key={st} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 2px 8px" }}>
                    <span className={`pill ${WORK_STATUS_META[st].pill}`}>{WORK_STATUS_META[st].th}</span>
                    <span style={{ fontSize: 12, color: "var(--ink-4)" }}>{groups.reduce((s, g) => s + g.tickets.length, 0)} งาน</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {groups.map((g) => (g.tickets.length > 1 ? <GroupedCardView key={g.key} group={g} /> : <JobCardView key={g.tickets[0].id} card={g.tickets[0]} />))}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function sortTickets(tickets: JobCard[], st: WorkStatus) {
  if (st === "waiting") tickets.sort((a, b) => urgencyKey(jobTiming(a)) - urgencyKey(jobTiming(b)) || a.createdAt.localeCompare(b.createdAt));
  else if (st === "in_progress") tickets.sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""));
  else tickets.sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
}

function sortGroups(groups: Group[], st: WorkStatus) {
  if (st === "waiting") {
    // Group urgency = most urgent ticket inside it.
    const gu = (g: Group) => Math.min(...g.tickets.map((t) => urgencyKey(jobTiming(t))));
    groups.sort((a, b) => gu(a) - gu(b) || a.tickets[0].createdAt.localeCompare(b.tickets[0].createdAt));
  } else if (st === "in_progress") {
    groups.sort((a, b) => (a.tickets[0].startedAt ?? "").localeCompare(b.tickets[0].startedAt ?? ""));
  } else {
    groups.sort((a, b) => (b.tickets[0].finishedAt ?? "").localeCompare(a.tickets[0].finishedAt ?? ""));
  }
}

/* ---- single ticket card (unchanged behaviour) --------------------------- */
function JobCardView({ card }: { card: JobCard }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const urgent = card.workStatus === "waiting" && isUrgent(jobTiming(card));
  const duration = formatDuration(card.startedAt, card.finishedAt);

  const act = (fn: (id: string) => Promise<{ ok: boolean; error?: string }>) => {
    setErr(null);
    start(async () => {
      const r = await fn(card.id);
      if (r.ok) router.refresh();
      else setErr(r.error || "ไม่สำเร็จ");
    });
  };

  return (
    <div className="card" style={{ padding: 16, borderLeft: urgent ? "4px solid var(--amber-ink)" : undefined, background: card.workStatus === "done" ? "var(--surface-2)" : "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{card.name}</div>
          <Qty value={card.quantity} unit={card.unit} />
        </div>
        <span className={`pill ${WORK_STATUS_META[card.workStatus].pill}`} style={{ flex: "none" }}>{WORK_STATUS_META[card.workStatus].th}</span>
      </div>

      <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 10, display: "flex", flexWrap: "wrap", gap: "2px 14px" }}>
        <span>สร้าง: {whenLabel(card.createdAt)}</span>
        <span style={{ color: urgent ? "var(--amber-ink)" : "var(--ink-4)", fontWeight: urgent ? 700 : 400 }}>กำหนด: {timingLabel(card.timingKind, card.timingDate, card.timingHours)}</span>
        {card.createdBy && <span>โดย: {card.createdBy}</span>}
        {card.workStatus === "in_progress" && card.startedAt && <span>เริ่ม: {whenLabel(card.startedAt)}</span>}
        {card.workStatus === "done" && duration && <span>ใช้เวลา: {duration}</span>}
      </div>

      {card.note ? <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 6, fontStyle: "italic" }}>📝 {card.note}</div> : null}

      {card.workStatus === "waiting" && <div style={{ marginTop: 12 }}><Btn kind="primary" icon="bolt" full onClick={() => act(startJob)} disabled={pending}>{pending ? "กำลังบันทึก…" : "เริ่มงาน"}</Btn></div>}
      {card.workStatus === "in_progress" && <div style={{ marginTop: 12 }}><Btn kind="primary" icon="check" full onClick={() => act(finishJob)} disabled={pending}>{pending ? "กำลังบันทึก…" : "เสร็จงาน"}</Btn></div>}
      {card.workStatus === "done" && <Doneline by={card.finishedBy} />}
      {err && <ErrLine msg={err} />}
    </div>
  );
}

/* ---- grouped card (display aggregation + safe batch action) ------------- */
function GroupedCardView({ group }: { group: Group }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const st = group.status;
  const ids = group.tickets.map((t) => t.id);
  const urgent = st === "waiting" && group.tickets.some((t) => isUrgent(jobTiming(t)));
  const n = group.tickets.length;

  const runBatch = (fn: (ids: string[]) => Promise<{ ok: boolean; error?: string }>) => {
    setErr(null);
    start(async () => {
      const r = await fn(ids);
      if (r.ok) router.refresh();
      else {
        setErr(r.error || "ไม่สำเร็จ");
        setConfirm(false);
      }
    });
  };

  return (
    <div className="card" style={{ padding: 16, borderLeft: urgent ? "4px solid var(--amber-ink)" : undefined, background: st === "done" ? "var(--surface-2)" : "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{group.name}</div>
          <Qty value={group.total} unit={group.unit} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flex: "none" }}>
          <span className={`pill ${WORK_STATUS_META[st].pill}`}>{WORK_STATUS_META[st].th}</span>
          <span className="pill grey">รวม {n} ตั๋ว</span>
        </div>
      </div>

      {/* breakdown (each ticket stays separate) */}
      <div style={{ marginTop: 10, borderTop: "1px solid var(--surface-3)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        {group.tickets.map((t) => (
          <div key={t.id} style={{ fontSize: 12, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="tnum" style={{ fontWeight: 700, color: "var(--ink-2)" }}>{t.quantity.toLocaleString()} {t.unit}</span>
            <span style={{ color: "var(--ink-4)" }}>· สร้าง {whenLabel(t.createdAt)}</span>
            {st === "waiting" && <span style={{ color: isUrgent(jobTiming(t)) ? "var(--amber-ink)" : "var(--ink-4)", fontWeight: isUrgent(jobTiming(t)) ? 700 : 400 }}>· {timingLabel(t.timingKind, t.timingDate, t.timingHours)}</span>}
            {t.createdBy && <span style={{ color: "var(--ink-4)" }}>· โดย {t.createdBy}</span>}
            {st === "done" && t.finishedAt && <span style={{ color: "var(--ink-4)" }}>· เสร็จ {whenLabel(t.finishedAt)}</span>}
            {expanded && st !== "done" && <PerTicketAction card={t} onDone={() => router.refresh()} />}
          </div>
        ))}
      </div>

      {st !== "done" && (
        <div style={{ marginTop: 12 }}>
          {!confirm ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn kind="primary" icon={st === "waiting" ? "bolt" : "check"} full onClick={() => setConfirm(true)} disabled={pending}>
                {st === "waiting" ? "เริ่มงานทั้งหมด" : "เสร็จงานทั้งหมด"}
              </Btn>
              <Btn kind="ghost" size="md" onClick={() => setExpanded((v) => !v)} disabled={pending}>{expanded ? "ซ่อน" : "รายตั๋ว"}</Btn>
            </div>
          ) : (
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>
                {st === "waiting" ? `เริ่มงานทั้งหมด ${n} ตั๋ว` : `ปิดงานทั้งหมด ${n} ตั๋ว`} สำหรับ {group.name} ใช่ไหม?
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn kind="ghost" size="sm" onClick={() => setConfirm(false)} disabled={pending}>ยกเลิก</Btn>
                <Btn kind="primary" size="sm" icon="check" onClick={() => runBatch(st === "waiting" ? startJobs : finishJobs)} disabled={pending}>
                  {pending ? "กำลังบันทึก…" : "ยืนยัน"}
                </Btn>
              </div>
            </div>
          )}
        </div>
      )}

      {st === "done" && <Doneline by={null} />}
      {err && <ErrLine msg={err} />}
    </div>
  );
}

/** Per-ticket action inside an expanded group (uses the single-ticket actions). */
function PerTicketAction({ card, onDone }: { card: JobCard; onDone: () => void }) {
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    const r = await (card.workStatus === "waiting" ? startJob(card.id) : finishJob(card.id));
    if (r.ok) onDone();
  });
  return (
    <button onClick={run} disabled={pending} className="focusable" style={{ marginLeft: "auto", border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--accent-ink)", borderRadius: 7, padding: "3px 9px", fontSize: 11.5, fontWeight: 600, cursor: pending ? "default" : "pointer" }}>
      {card.workStatus === "waiting" ? "เริ่มเฉพาะตั๋วนี้" : "เสร็จเฉพาะตั๋วนี้"}
    </button>
  );
}

function Qty({ value, unit }: { value: number; unit: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
      <span className="tnum" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: "var(--accent)" }}>{value.toLocaleString()}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-3)" }}>{unit}</span>
    </div>
  );
}
function Doneline({ by }: { by: string | null }) {
  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, color: "var(--green-ink)", fontSize: 13, fontWeight: 600 }}>
      <Icon name="check" size={16} /> เสร็จงานแล้ว{by ? ` · ${by}` : ""}
    </div>
  );
}
function ErrLine({ msg }: { msg: string }) {
  return <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 9, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 12.5, fontWeight: 600 }}>{msg}</div>;
}
