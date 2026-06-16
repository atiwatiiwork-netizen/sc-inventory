"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { Btn, Field, Panel, ScreenHead, SelectInput, TextInput } from "@/components/ui";

export type HistoryLine = { label: string; qty: number; unit: string };
export type SubmissionCard = {
  key: string;
  date: string;
  time: string;
  ts: number;
  worker: string;
  workerId: string;
  type: "pack" | "assemble";
  total: number;
  unit: string;
  items: HistoryLine[];
};

const TYPE_TH: Record<"pack" | "assemble", string> = { pack: "แพ็คกล่อง", assemble: "ประกอบ" };
const TYPE_PILL: Record<"pack" | "assemble", string> = { pack: "blue", assemble: "green" };

function thaiDate(d: string): string {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

export function HistoryClient({ cards, workers }: { cards: SubmissionCard[]; workers: { id: string; name: string }[] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [worker, setWorker] = useState("all");
  const [type, setType] = useState<"all" | "pack" | "assemble">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = useMemo(
    () =>
      cards
        .filter(
          (c) =>
            (worker === "all" || c.workerId === worker) &&
            (type === "all" || c.type === type) &&
            (!from || c.date >= from) &&
            (!to || c.date <= to),
        )
        .sort((a, b) => b.ts - a.ts),
    [cards, worker, type, from, to],
  );

  const groups = useMemo(() => {
    const m = new Map<string, SubmissionCard[]>();
    for (const c of filtered) {
      const arr = m.get(c.date) ?? [];
      arr.push(c);
      m.set(c.date, arr);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const clear = () => {
    setFrom("");
    setTo("");
    setWorker("all");
    setType("all");
  };
  const dirty = !!from || !!to || worker !== "all" || type !== "all";

  return (
    <div className="fade-up" style={{ maxWidth: 680, margin: "0 auto" }}>
      <ScreenHead th="ประวัติการผลิต" en="Production History · ใคร ผลิตอะไร เมื่อไหร่" />

      {/* filters */}
      <Panel style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="ตั้งแต่วันที่" en="From">
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="ถึงวันที่" en="To">
            <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="พนักงาน" en="Worker">
            <SelectInput value={worker} onChange={(e) => setWorker(e.target.value)}>
              <option value="all">ทุกคน</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="ประเภท" en="Type">
            <SelectInput value={type} onChange={(e) => setType(e.target.value as "all" | "pack" | "assemble")}>
              <option value="all">ทั้งหมด</option>
              <option value="pack">แพ็คกล่อง</option>
              <option value="assemble">ประกอบ</option>
            </SelectInput>
          </Field>
        </div>
        {dirty && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>พบ {filtered.length} รายการ</span>
            <Btn kind="ghost" size="sm" icon="x" onClick={clear}>ล้างตัวกรอง</Btn>
          </div>
        )}
      </Panel>

      {groups.length === 0 ? (
        <Panel>
          <div style={{ padding: 22, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>ไม่พบประวัติการผลิต</div>
        </Panel>
      ) : (
        groups.map(([date, list]) => (
          <div key={date} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "0 2px 8px" }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{thaiDate(date)}</span>
              <span style={{ fontSize: 12, color: "var(--ink-4)" }}>{list.length} รายการ</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {list.map((c) => {
                const open = !!expanded[c.key];
                return (
                  <div key={c.key} className="card" style={{ overflow: "hidden" }}>
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [c.key]: !e[c.key] }))}
                      className="focusable"
                      style={{ width: "100%", border: "none", background: "transparent", padding: "13px 15px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 52, flex: "none" }}>
                        <Icon name="clock" size={16} style={{ color: "var(--ink-4)" }} />
                        <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700, marginTop: 2 }}>{c.time}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span className={`pill ${TYPE_PILL[c.type]}`}>{TYPE_TH[c.type]}</span>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{c.worker}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 3 }}>{c.items.length} รายการ</div>
                      </div>
                      <div style={{ textAlign: "right", flex: "none" }}>
                        <div className="tnum" style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>{c.total.toLocaleString()}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{c.unit}</div>
                      </div>
                      <Icon name={open ? "chevD" : "chevR"} size={18} style={{ color: "var(--ink-4)", flex: "none" }} />
                    </button>

                    {open && (
                      <div style={{ borderTop: "1px solid var(--border)", padding: "6px 15px 12px" }}>
                        {c.items.map((it, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--surface-3)" }}>
                            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{it.label}</span>
                            <span className="tnum" style={{ fontSize: 14, fontWeight: 700 }}>
                              {it.qty.toLocaleString()} <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400 }}>{it.unit}</span>
                            </span>
                          </div>
                        ))}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>รวมรายการนี้</span>
                          <span className="tnum" style={{ fontSize: 16, fontWeight: 700, color: "var(--accent-ink)" }}>{c.total.toLocaleString()} {c.unit}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
