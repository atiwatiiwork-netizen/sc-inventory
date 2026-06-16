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
import { startJob, finishJob } from "@/app/worker/(secure)/wheels/actions";

export type JobCard = {
  id: string;
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

export function JobTicketClient({ cards, lineReady }: { cards: JobCard[]; lineReady: boolean }) {
  const grouped = useMemo(() => {
    const byCat = new Map<ProductCategory, Map<WorkStatus, JobCard[]>>();
    for (const cat of CATEGORY_ORDER) byCat.set(cat, new Map(STATUS_ORDER.map((s) => [s, [] as JobCard[]])));
    for (const c of cards) byCat.get(c.category)?.get(c.workStatus)?.push(c);

    for (const cat of CATEGORY_ORDER) {
      const m = byCat.get(cat)!;
      m.get("waiting")!.sort((a, b) => urgencyKey(jobTiming(a)) - urgencyKey(jobTiming(b)) || a.createdAt.localeCompare(b.createdAt));
      m.get("in_progress")!.sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? "")); // oldest started first
      m.get("done")!.sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? "")); // newest finished first
    }
    return byCat;
  }, [cards]);

  return (
    <div className="fade-up" style={{ maxWidth: 680, margin: "0 auto" }}>
      <ScreenHead th="ตั๋วสั่งงาน" en="Job Tickets · งานที่สั่งเข้าโรงงาน" />
      <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 6 }}>
        งานที่ถูกสั่งเข้ามาจากออฟฟิศหรือหัวหน้างาน · กดเริ่มงาน/เสร็จงานเพื่ออัปเดตสถานะ (ไม่ตัดสต็อก ไม่บันทึกการผลิต)
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
              const list = m.get(st)!;
              if (list.length === 0) return null;
              return (
                <div key={st} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 2px 8px" }}>
                    <span className={`pill ${WORK_STATUS_META[st].pill}`}>{WORK_STATUS_META[st].th}</span>
                    <span style={{ fontSize: 12, color: "var(--ink-4)" }}>{list.length} งาน</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {list.map((c) => (
                      <JobCardView key={c.id} card={c} />
                    ))}
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

const jobTiming = (c: JobCard) => ({ timing_kind: c.timingKind, timing_date: c.timingDate, timing_hours: c.timingHours });

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
    <div
      className="card"
      style={{
        padding: 16,
        borderLeft: urgent ? "4px solid var(--amber-ink)" : undefined,
        background: card.workStatus === "done" ? "var(--surface-2)" : "var(--surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{card.name}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
            <span className="tnum" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: "var(--accent)" }}>
              {card.quantity.toLocaleString()}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-3)" }}>{card.unit}</span>
          </div>
        </div>
        <span className={`pill ${WORK_STATUS_META[card.workStatus].pill}`} style={{ flex: "none" }}>{WORK_STATUS_META[card.workStatus].th}</span>
      </div>

      <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 10, display: "flex", flexWrap: "wrap", gap: "2px 14px" }}>
        <span>สร้าง: {whenLabel(card.createdAt)}</span>
        <span style={{ color: urgent ? "var(--amber-ink)" : "var(--ink-4)", fontWeight: urgent ? 700 : 400 }}>
          กำหนด: {timingLabel(card.timingKind, card.timingDate, card.timingHours)}
        </span>
        {card.createdBy && <span>โดย: {card.createdBy}</span>}
        {card.workStatus === "in_progress" && card.startedAt && <span>เริ่ม: {whenLabel(card.startedAt)}</span>}
        {card.workStatus === "done" && duration && <span>ใช้เวลา: {duration}</span>}
      </div>

      {card.note ? <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 6, fontStyle: "italic" }}>📝 {card.note}</div> : null}

      {card.workStatus !== "done" && (
        <div style={{ marginTop: 12 }}>
          {card.workStatus === "waiting" ? (
            <Btn kind="primary" icon="bolt" full onClick={() => act(startJob)} disabled={pending}>{pending ? "กำลังบันทึก…" : "เริ่มงาน"}</Btn>
          ) : (
            <Btn kind="primary" icon="check" full onClick={() => act(finishJob)} disabled={pending}>{pending ? "กำลังบันทึก…" : "เสร็จงาน"}</Btn>
          )}
        </div>
      )}

      {card.workStatus === "done" && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, color: "var(--green-ink)", fontSize: 13, fontWeight: 600 }}>
          <Icon name="check" size={16} /> เสร็จงานแล้ว{card.finishedBy ? ` · ${card.finishedBy}` : ""}
        </div>
      )}

      {err && <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 9, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 12.5, fontWeight: 600 }}>{err}</div>}
    </div>
  );
}
