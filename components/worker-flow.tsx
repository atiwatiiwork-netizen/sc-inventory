"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category, CustomerGroup, Product } from "@/lib/types";
import { entryGroups, sumMeters, sumQty } from "@/lib/grouping";
import { GROUP_ICON, CAT_ICON } from "@/lib/nav";
import { Icon, type IconName } from "@/components/icon";
import { Btn } from "@/components/ui";
import { workerSignOut } from "@/app/auth/actions";
import { submitUsage, sendCategoryLine } from "@/app/worker/(secure)/actions";

export type ExistingSubmission = {
  group: string | null;
  noUsage: boolean;
  items: Record<string, number>;
  time: string;
};

// Worker flow is CATEGORY-first: catpick → pick (customer group) → entry → review.
type Step = "catpick" | "pick" | "entry" | "review" | "success" | "summary";

export function WorkerFlow({
  worker,
  customerGroups,
  categories,
  products,
  today,
  existing,
  recorded,
  sent,
}: {
  worker: { name: string; code: string };
  customerGroups: CustomerGroup[];
  categories: Category[];
  products: Product[];
  today: string;
  existing: ExistingSubmission[];
  recorded: Record<string, string[]>;
  sent: string[];
}) {
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const catIdsByCat = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const c of categories) m.set(c.id, new Set(products.filter((p) => p.category_id === c.id).map((p) => p.id)));
    return m;
  }, [categories, products]);
  const router = useRouter();

  const [subs, setSubs] = useState<ExistingSubmission[]>(existing);
  const [step, setStep] = useState<Step>("catpick");
  const [date] = useState(today);
  const [currentCat, setCurrentCat] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [noUsage, setNoUsage] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // per-category progress (groups recorded) + LINE-sent status, mirrored locally
  const [marksByCat, setMarksByCat] = useState<Record<string, Set<string>>>(() => {
    const m: Record<string, Set<string>> = {};
    for (const [cat, gs] of Object.entries(recorded)) m[cat] = new Set(gs);
    return m;
  });
  const [sentCats, setSentCats] = useState<Set<string>>(new Set(sent));
  const [lineMsg, setLineMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const groupCount = customerGroups.length;
  const statusOf = (catId: string) => ({ recorded: marksByCat[catId]?.size ?? 0, total: groupCount, sent: sentCats.has(catId) });

  const sendLine = (catId: string) => {
    setLineMsg(null);
    start(async () => {
      const res = await sendCategoryLine({ date, categoryId: catId });
      if (res.ok) {
        setSentCats((prev) => new Set(prev).add(catId));
        setLineMsg({ ok: true, text: `ส่ง LINE หมวดนี้แล้ว · ${res.time ?? ""} น.` });
        router.refresh();
      } else {
        setLineMsg({ ok: false, text: res.error || "ส่ง LINE ไม่สำเร็จ" });
      }
    });
  };

  const groupName = (id: string | null) => customerGroups.find((g) => g.id === id)?.name;
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name;
  const setOne = (id: string, val: number | string) =>
    setQty((q) => {
      const n = { ...q };
      const v = Number(val) || 0;
      if (v) n[id] = v;
      else delete n[id];
      return n;
    });

  const total = sumQty(qty);

  // how much of a category has been recorded today across all groups
  const catTotalToday = (catId: string) => {
    const ids = catIdsByCat.get(catId) ?? new Set();
    let t = 0;
    for (const s of subs) {
      if (s.noUsage) continue;
      for (const [id, q] of Object.entries(s.items)) if (ids.has(id)) t += q;
    }
    return t;
  };
  // groups that already have items for the current category
  const groupsWithCat = (catId: string) => {
    const ids = catIdsByCat.get(catId) ?? new Set();
    return new Set(subs.filter((s) => !s.noUsage && s.group && Object.entries(s.items).some(([id, q]) => ids.has(id) && q > 0)).map((s) => s.group as string));
  };

  const pickCat = (catId: string) => {
    setCurrentCat(catId);
    setNoUsage(false);
    setError(null);
    setLineMsg(null);
    setStep("pick");
  };

  const pickGroup = (g: string) => {
    const ids = catIdsByCat.get(currentCat ?? "") ?? new Set();
    const ex = subs.find((s) => !s.noUsage && s.group === g);
    const prefill = ex ? Object.fromEntries(Object.entries(ex.items).filter(([id]) => ids.has(id))) : {};
    setGroup(g);
    setQty(prefill);
    setStep("entry");
  };

  const startNoUsage = () => {
    setNoUsage(true);
    setGroup(null);
    setCurrentCat(null);
    setQty({});
    setError(null);
    setStep("review");
  };

  const confirm = () => {
    setError(null);
    const lines = Object.entries(qty).map(([product_id, q]) => ({ product_id, qty: q }));
    start(async () => {
      const res = await submitUsage({ date, group, noUsage, categoryId: currentCat, lines });
      if (!res.ok) {
        setError(res.error || "ส่งข้อมูลไม่สำเร็จ");
        return;
      }
      const t = res.time ?? new Date().toTimeString().slice(0, 5);
      setTime(t);
      setSubs((prev) => {
        if (noUsage) {
          const kept = prev.filter((s) => !s.noUsage);
          return [...kept, { group: null, noUsage: true, items: {}, time: t }];
        }
        const ids = catIdsByCat.get(currentCat ?? "") ?? new Set();
        const ex = prev.find((s) => !s.noUsage && s.group === group);
        const otherItems = ex ? Object.fromEntries(Object.entries(ex.items).filter(([id]) => !ids.has(id))) : {};
        const merged = { ...otherItems, ...qty };
        const kept = prev.filter((s) => s.noUsage || s.group !== group);
        return [...kept, { group, noUsage: false, items: merged, time: t }];
      });
      if (!noUsage && currentCat && group) {
        // record this (category, group); reset the category's sent flag (data changed)
        setMarksByCat((prev) => {
          const m = { ...prev };
          const s = new Set(m[currentCat] ?? []);
          s.add(group);
          m[currentCat] = s;
          return m;
        });
        setSentCats((prev) => {
          const s = new Set(prev);
          s.delete(currentCat);
          return s;
        });
      }
      setStep("success");
      router.refresh();
    });
  };

  return (
    <Shell>
      {step === "catpick" && (
        <CatPickScreen
          worker={worker}
          categories={categories}
          catTotalToday={catTotalToday}
          statusOf={statusOf}
          hasSubs={subs.length > 0}
          onPickCat={pickCat}
          onNoUsage={startNoUsage}
          onSummary={() => setStep("summary")}
        />
      )}

      {step === "pick" && (
        <PickScreen
          catName={catName(currentCat)}
          customerGroups={customerGroups}
          doneGroups={groupsWithCat(currentCat ?? "")}
          complete={(marksByCat[currentCat ?? ""]?.size ?? 0) >= groupCount && groupCount > 0}
          sent={sentCats.has(currentCat ?? "")}
          recordedCount={marksByCat[currentCat ?? ""]?.size ?? 0}
          groupCount={groupCount}
          sending={pending}
          lineMsg={lineMsg}
          onSend={() => currentCat && sendLine(currentCat)}
          onBack={() => setStep("catpick")}
          onPick={pickGroup}
        />
      )}

      {step === "entry" && (
        <EntryScreen
          category={categories.find((c) => c.id === currentCat)}
          products={products}
          qty={qty}
          setOne={setOne}
          groupName={groupName(group)}
          total={total}
          onBack={() => setStep("pick")}
          onNext={() => setStep("review")}
        />
      )}

      {step === "review" && (
        <ReviewScreen
          date={date}
          group={group}
          groupName={groupName(group)}
          catName={catName(currentCat)}
          noUsage={noUsage}
          qty={qty}
          byId={byId}
          error={error}
          pending={pending}
          onEdit={() => setStep(noUsage ? "catpick" : "entry")}
          onConfirm={confirm}
        />
      )}

      {step === "success" && (
        <SuccessScreen
          catName={catName(currentCat)}
          groupName={groupName(group)}
          noUsage={noUsage}
          total={total}
          time={time}
          onAnother={() => setStep("catpick")}
          onDone={() => setStep("summary")}
        />
      )}

      {step === "summary" && (
        <SummaryScreen worker={worker} subs={subs} groupName={groupName} onAdd={() => setStep("catpick")} />
      )}
    </Shell>
  );
}

/* ---------- shell (mobile-first frame) ---------- */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", background: "var(--surface-2)" }}>
      <div style={{ width: "100%", maxWidth: 420, minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--surface)" }}>
        {children}
      </div>
    </div>
  );
}

function LogoutBtn() {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => workerSignOut())}
      disabled={pending}
      style={{ border: "1px solid var(--border-2)", background: "var(--surface)", borderRadius: 11, padding: "8px 12px", color: "var(--ink-2)", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}
    >
      <Icon name="logout" size={16} /> ออก
    </button>
  );
}

/* ---------- 1) category picker (landing) ---------- */
function CatPickScreen({
  worker,
  categories,
  catTotalToday,
  statusOf,
  hasSubs,
  onPickCat,
  onNoUsage,
  onSummary,
}: {
  worker: { name: string; code: string };
  categories: Category[];
  catTotalToday: (catId: string) => number;
  statusOf: (catId: string) => { recorded: number; total: number; sent: boolean };
  hasSubs: boolean;
  onPickCat: (catId: string) => void;
  onNoUsage: () => void;
  onSummary: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px 14px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.01em" }}>สวัสดี {worker.name}</div>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{worker.code}</div>
        </div>
        <LogoutBtn />
      </div>

      <div style={{ padding: "4px 18px 22px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <Label th="เลือกหมวดหมู่สินค้า" en="Choose a product category" />
        {categories.map((c) => {
          const t = catTotalToday(c.id);
          const st = statusOf(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onPickCat(c.id)}
              className="card focusable"
              style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, textAlign: "left", border: "1px solid var(--border)" }}
            >
              <span style={{ width: 46, height: 46, borderRadius: 13, background: t > 0 ? "var(--accent-soft)" : "var(--surface-3)", color: t > 0 ? "var(--accent)" : "var(--ink-3)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <Icon name={(CAT_ICON[c.id] as IconName) || "box"} size={24} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 1 }}>
                  {t > 0 ? <span className="tnum">ใช้วันนี้ {t}</span> : <span>ยังไม่กรอก</span>}
                </div>
              </div>
              <CatStatusBadge recorded={st.recorded} total={st.total} sent={st.sent} />
            </button>
          );
        })}

        <button
          onClick={onNoUsage}
          className="focusable"
          style={{ padding: "15px 18px", display: "flex", alignItems: "center", gap: 14, textAlign: "left", borderRadius: 14, border: "1.5px dashed var(--border-2)", background: "transparent", color: "var(--ink-2)", marginTop: 4 }}
        >
          <span style={{ width: 46, height: 46, borderRadius: 13, background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Icon name="x" size={22} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>วันนี้ไม่มีการใช้งาน</div>
            <div className="en" style={{ fontSize: 12 }}>No usage today</div>
          </div>
        </button>
      </div>

      {hasSubs && (
        <div style={{ position: "sticky", bottom: 0, padding: 14, background: "linear-gradient(transparent, var(--surface-2) 26%)" }}>
          <Btn kind="soft" size="lg" full icon="doc" onClick={onSummary}>
            ดูสรุปวันนี้ <span className="en">Today&apos;s summary</span>
          </Btn>
        </div>
      )}
    </div>
  );
}

/* ---------- 2) customer-group picker (+ per-category LINE send) ---------- */
function PickScreen({
  catName,
  customerGroups,
  doneGroups,
  complete,
  sent,
  recordedCount,
  groupCount,
  sending,
  lineMsg,
  onSend,
  onBack,
  onPick,
}: {
  catName?: string;
  customerGroups: CustomerGroup[];
  doneGroups: Set<string>;
  complete: boolean;
  sent: boolean;
  recordedCount: number;
  groupCount: number;
  sending: boolean;
  lineMsg: { ok: boolean; text: string } | null;
  onSend: () => void;
  onBack: () => void;
  onPick: (g: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 14px 12px" }}>
        <button onClick={onBack} style={{ border: "none", background: "var(--surface-3)", borderRadius: 11, width: 38, height: 38, color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <Icon name="chevL" size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>เลือกกลุ่มลูกค้า</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{catName}</div>
        </div>
      </div>
      <div style={{ padding: "4px 18px 22px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {customerGroups.map((g) => {
          const done = doneGroups.has(g.id);
          return (
            <button
              key={g.id}
              onClick={() => onPick(g.id)}
              className="card focusable"
              style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, textAlign: "left", border: "1px solid var(--border)" }}
            >
              <span style={{ width: 46, height: 46, borderRadius: 13, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <Icon name={(GROUP_ICON[g.id] as IconName) || "users"} size={24} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 600 }}>{g.name}</div>
                <div className="en" style={{ fontSize: 12 }}>{g.name_en}</div>
              </div>
              {done ? <span className="pill green">บันทึกแล้ว · แก้ไข</span> : <Icon name="chevR" size={20} style={{ color: "var(--ink-4)" }} />}
            </button>
          );
        })}
      </div>

      {/* per-category LINE send — only when all groups are recorded */}
      <div style={{ position: "sticky", bottom: 0, padding: 14, background: "linear-gradient(transparent, var(--surface-2) 26%)" }}>
        {lineMsg && (
          <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: lineMsg.ok ? "var(--green-soft)" : "var(--red-soft)", color: lineMsg.ok ? "var(--green-ink)" : "var(--red-ink)" }}>
            {lineMsg.text}
          </div>
        )}
        {complete ? (
          sent ? (
            <Btn kind="soft" size="lg" full icon="chat" disabled={sending} onClick={onSend}>
              <Icon name="check" size={17} /> ส่ง LINE แล้ว · ส่งซ้ำ <span className="en">Re-send</span>
            </Btn>
          ) : (
            <Btn kind="primary" size="lg" full icon="chat" disabled={sending} onClick={onSend} style={{ boxShadow: "var(--sh-2)" }}>
              {sending ? "กำลังส่ง…" : "ส่ง LINE (หมวดนี้)"} <span className="en" style={{ color: "rgba(255,255,255,.75)" }}>Send</span>
            </Btn>
          )
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderRadius: 12, background: "var(--amber-soft)", color: "var(--amber-ink)", fontSize: 13, fontWeight: 600 }}>
            <Icon name="alert" size={16} style={{ flex: "none" }} /> กรอกให้ครบทุกกลุ่มก่อนส่ง LINE ({recordedCount}/{groupCount} กลุ่ม)
          </div>
        )}
      </div>
    </div>
  );
}

/* category status chip on the landing screen */
function CatStatusBadge({ recorded, total, sent }: { recorded: number; total: number; sent: boolean }) {
  if (sent)
    return (
      <span className="pill green" style={{ flex: "none" }}>
        <Icon name="check" size={13} /> ส่ง LINE แล้ว
      </span>
    );
  if (recorded >= total && total > 0)
    return (
      <span className="pill amber" style={{ flex: "none" }}>
        <Icon name="alert" size={13} /> รอส่ง LINE
      </span>
    );
  if (recorded > 0)
    return (
      <span className="pill amber" style={{ flex: "none" }}>
        <Icon name="alert" size={13} /> {recorded}/{total} กลุ่ม
      </span>
    );
  return (
    <span className="pill grey" style={{ flex: "none" }}>
      <Icon name="chevR" size={14} />
    </span>
  );
}

/* ---------- 3) entry for one category ---------- */
function EntryScreen({
  category,
  products,
  qty,
  setOne,
  groupName,
  total,
  onBack,
  onNext,
}: {
  category: Category | undefined;
  products: Product[];
  qty: Record<string, number>;
  setOne: (id: string, v: number | string) => void;
  groupName?: string;
  total: number;
  onBack: () => void;
  onNext: () => void;
}) {
  if (!category) return null;
  const groups = entryGroups(category, products);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 10px" }}>
          <button onClick={onBack} style={{ border: "none", background: "var(--surface-3)", borderRadius: 11, width: 38, height: 38, color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="chevL" size={20} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{category.name}</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{groupName}</div>
          </div>
          <span className="pill blue tnum">{total}</span>
        </div>
      </div>

      <div style={{ padding: "14px 16px 120px", display: "flex", flexDirection: "column", gap: 14 }}>
        {category.viz === "rail" ? (
          groups.map((g) => (
            <div key={g.key} className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-2)", marginBottom: 8 }}>{g.label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7 }}>
                {g.items.map((p) => (
                  <div key={p.id}>
                    <div style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={p.name}>{p.length || p.name}</div>
                    <input
                      className="tnum focusable"
                      inputMode="numeric"
                      value={qty[p.id] || ""}
                      placeholder="0"
                      onChange={(e) => setOne(p.id, e.target.value.replace(/\D/g, "").slice(0, 4))}
                      style={{
                        width: "100%",
                        height: 52,
                        textAlign: "center",
                        fontSize: 20,
                        fontWeight: 700,
                        borderRadius: 11,
                        border: "1px solid var(--border-2)",
                        background: qty[p.id] ? "var(--accent-soft)" : "var(--surface-2)",
                        color: qty[p.id] ? "var(--accent-ink)" : "var(--ink-4)",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            {groups.flatMap((g) => g.items).map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: "1px solid var(--surface-3)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{p.sku} · {p.unit}</div>
                </div>
                <Stepper value={qty[p.id] || 0} onChange={(v) => setOne(p.id, v)} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: "sticky", bottom: 0, padding: 14, background: "linear-gradient(transparent, var(--surface-2) 26%)" }}>
        <Btn kind="primary" size="lg" full onClick={onNext} style={{ boxShadow: "var(--sh-2)" }}>
          ตรวจทานก่อนส่ง <span className="en" style={{ color: "rgba(255,255,255,.75)" }}>Review</span> · {total} รายการ
        </Btn>
      </div>
    </div>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const v = Number(value) || 0;
  const btn = (icon: IconName, d: number) => (
    <button
      onClick={() => onChange(Math.max(0, v + d))}
      className="focusable"
      style={{ width: 46, height: 46, borderRadius: 12, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}
    >
      <Icon name={icon} size={20} />
    </button>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {btn("minus", -1)}
      <input
        className="tnum focusable"
        inputMode="numeric"
        value={value || ""}
        placeholder="0"
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "").slice(0, 4)) || 0)}
        style={{
          width: 56,
          height: 46,
          textAlign: "center",
          fontSize: 21,
          fontWeight: 700,
          borderRadius: 12,
          border: "1px solid var(--border-2)",
          background: v ? "var(--accent-soft)" : "var(--surface)",
          color: v ? "var(--accent-ink)" : "var(--ink-4)",
        }}
      />
      {btn("plus", 1)}
    </div>
  );
}

/* ---------- 4) review ---------- */
function ReviewScreen({
  date,
  group,
  groupName,
  catName,
  noUsage,
  qty,
  byId,
  error,
  pending,
  onEdit,
  onConfirm,
}: {
  date: string;
  group: string | null;
  groupName?: string;
  catName?: string;
  noUsage: boolean;
  qty: Record<string, number>;
  byId: Map<string, Product>;
  error: string | null;
  pending: boolean;
  onEdit: () => void;
  onConfirm: () => void;
}) {
  const fmt = new Date(date).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const entries = Object.entries(qty)
    .map(([id, n]) => ({ p: byId.get(id), n }))
    .filter((e) => e.p) as { p: Product; n: number }[];
  const total = sumQty(qty);
  const meters = sumMeters(qty, byId);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ padding: "16px 18px 4px" }}>
        <div style={{ fontSize: 21, fontWeight: 700 }}>ตรวจทานก่อนส่ง</div>
        <div className="en" style={{ fontSize: 13 }}>Review before submit · nothing is saved yet</div>
      </div>
      <div style={{ padding: "12px 16px 130px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <ReviewRow icon="calendar" label="วันที่" value={fmt} />
          {!noUsage && (
            <>
              <div style={{ height: 1, background: "var(--surface-3)" }} />
              <ReviewRow icon="layers" label="หมวดหมู่" value={catName ?? ""} />
            </>
          )}
          <div style={{ height: 1, background: "var(--surface-3)" }} />
          <ReviewRow icon={group ? (GROUP_ICON[group] as IconName) || "users" : "x"} label="กลุ่มลูกค้า" value={noUsage ? "ไม่มีการใช้งานวันนี้" : groupName ?? ""} />
        </div>

        {noUsage ? (
          <div className="card" style={{ padding: "26px 16px", textAlign: "center", color: "var(--ink-3)" }}>
            <Icon name="check" size={30} style={{ color: "var(--green)" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-2)", marginTop: 6 }}>วันนี้ไม่มีการใช้งานสต็อก</div>
            <div className="en" style={{ fontSize: 12 }}>A &ldquo;no usage&rdquo; record will be submitted</div>
          </div>
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>รายการที่กรอก</span>
              <span className="en" style={{ fontSize: 12 }}>{entries.length} items</span>
            </div>
            {entries.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>ยังไม่ได้กรอกจำนวน</div>}
            {entries.map(({ p, n }) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: "1px solid var(--surface-3)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{p.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{p.sku}</div>
                </div>
                <div className="tnum" style={{ fontSize: 19, fontWeight: 700 }}>
                  {n}
                  <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500, marginLeft: 3 }}>{p.unit}</span>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", background: "var(--surface-2)" }}>
              <div>
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>รวมหมวดนี้</div>
                {meters > 0 && <div className="en" style={{ fontSize: 11.5 }}>{meters} meters of rail</div>}
              </div>
              <div className="tnum" style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)" }}>{total}</div>
            </div>
          </div>
        )}

        {error && <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>{error}</div>}
      </div>

      <div style={{ position: "sticky", bottom: 0, padding: 14, background: "linear-gradient(transparent, var(--surface-2) 26%)", display: "flex", gap: 10 }}>
        <Btn kind="default" size="lg" onClick={onEdit} disabled={pending} style={{ flex: "0 0 38%" }} icon="edit">แก้ไข</Btn>
        <Btn kind="primary" size="lg" onClick={onConfirm} disabled={pending} style={{ flex: 1 }} icon="check">
          {pending ? "กำลังส่ง…" : "ยืนยันและส่ง"}
        </Btn>
      </div>
    </div>
  );
}

/* ---------- 5) success ---------- */
function SuccessScreen({
  catName,
  groupName,
  noUsage,
  total,
  time,
  onAnother,
  onDone,
}: {
  catName?: string;
  groupName?: string;
  noUsage: boolean;
  total: number;
  time: string;
  onAnother: () => void;
  onDone: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 22px 26px", minHeight: "100vh" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", width: "100%" }}>
        <div style={{ width: 92, height: 92, borderRadius: 99, background: "var(--green-soft)", display: "flex", alignItems: "center", justifyContent: "center", animation: "checkPop .45s cubic-bezier(.2,.8,.2,1) both" }}>
          <div style={{ width: 64, height: 64, borderRadius: 99, background: "var(--green)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="check" size={38} stroke={2.6} />
          </div>
        </div>
        <div style={{ fontSize: 23, fontWeight: 700, marginTop: 20 }}>ส่งข้อมูลเรียบร้อย</div>
        <div className="en" style={{ fontSize: 13, marginTop: 2 }}>Submitted successfully</div>

        <div className="card" style={{ width: "100%", padding: 16, marginTop: 22, textAlign: "left", display: "flex", flexDirection: "column", gap: 10 }}>
          {!noUsage && <RowKV k="หมวดหมู่" v={catName ?? ""} />}
          <RowKV k="กลุ่มลูกค้า" v={noUsage ? "ไม่มีการใช้งาน" : groupName ?? ""} />
          <RowKV k="จำนวนรวม" v={noUsage ? "—" : `${total} รายการ`} />
          <RowKV k="เวลาส่ง" v={time} mono />
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="chat" size={15} style={{ color: "var(--green)" }} /> ระบบบันทึกการใช้และตัดสต็อกแล้ว
        </div>
      </div>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
        <Btn kind="soft" size="lg" full onClick={onAnother} icon="plus">
          บันทึกหมวด/กลุ่มอื่น <span className="en">Record more</span>
        </Btn>
        <Btn kind="primary" size="lg" full onClick={onDone} icon="check">
          เสร็จสิ้น · ดูสรุปวันนี้ <span className="en" style={{ color: "rgba(255,255,255,.7)" }}>Done</span>
        </Btn>
      </div>
    </div>
  );
}

/* ---------- today summary (per customer group) ---------- */
function SummaryScreen({
  worker,
  subs,
  groupName,
  onAdd,
}: {
  worker: { name: string; code: string };
  subs: ExistingSubmission[];
  groupName: (id: string | null) => string | undefined;
  onAdd: () => void;
}) {
  const grand = subs.reduce((s, x) => s + (x.noUsage ? 0 : sumQty(x.items)), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px 14px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.01em" }}>บันทึกวันนี้</div>
          <div className="en" style={{ fontSize: 12 }}>{worker.name} · {subs.length} กลุ่ม</div>
        </div>
        <LogoutBtn />
      </div>

      <div style={{ padding: "4px 18px 18px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>รวมทั้งวัน</div>
            <div className="tnum" style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{grand} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-3)" }}>รายการ</span></div>
          </div>
        </div>
        {subs.map((s, i) => {
          const t = s.noUsage ? 0 : sumQty(s.items);
          return (
            <div key={i} className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 13 }}>
              <span style={{ width: 42, height: 42, borderRadius: 12, background: s.noUsage ? "var(--surface-3)" : "var(--accent-soft)", color: s.noUsage ? "var(--ink-3)" : "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <Icon name={s.noUsage ? "x" : (GROUP_ICON[s.group ?? ""] as IconName) || "users"} size={22} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 600 }}>{s.noUsage ? "ไม่มีการใช้งานวันนี้" : groupName(s.group)}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{s.noUsage ? "—" : `${t} รายการ`} · ส่ง {s.time} น.</div>
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.6, padding: "2px 2px" }}>
          ต้องการแก้ไข? กด &ldquo;บันทึกเพิ่ม&rdquo; → เลือกหมวด → เลือกกลุ่มเดิม (จะมีป้าย &ldquo;บันทึกแล้ว&rdquo;)
        </div>
      </div>

      <div style={{ position: "sticky", bottom: 0, padding: 14, background: "linear-gradient(transparent, var(--surface-2) 26%)" }}>
        <Btn kind="primary" size="lg" full icon="plus" onClick={onAdd} style={{ boxShadow: "var(--sh-2)" }}>
          บันทึกเพิ่ม <span className="en">Record more</span>
        </Btn>
      </div>
    </div>
  );
}

/* ---------- small bits ---------- */
function Label({ th, en }: { th: string; en: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>{th}</span>
      <span className="en" style={{ fontSize: 11.5 }}>{en}</span>
    </div>
  );
}
function ReviewRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 38, height: 38, borderRadius: 11, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <Icon name={icon} size={19} />
      </span>
      <div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{label}</div>
        <div style={{ fontSize: 15.5, fontWeight: 600, textTransform: "capitalize" }}>{value}</div>
      </div>
    </div>
  );
}
function RowKV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 13.5, color: "var(--ink-3)" }}>{k}</span>
      <span className={mono ? "mono" : ""} style={{ fontSize: 14.5, fontWeight: 600 }}>{v}</span>
    </div>
  );
}
