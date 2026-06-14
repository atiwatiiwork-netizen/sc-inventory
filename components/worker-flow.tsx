"use client";

import { useMemo, useState, useTransition } from "react";
import type { Category, CustomerGroup, Product } from "@/lib/types";
import { entryGroups, sumMeters, sumQty } from "@/lib/grouping";
import { GROUP_ICON } from "@/lib/nav";
import { Icon, type IconName } from "@/components/icon";
import { Btn } from "@/components/ui";
import { workerSignOut } from "@/app/auth/actions";
import { submitUsage } from "@/app/worker/(secure)/actions";

export type ExistingSubmission = {
  group: string | null;
  noUsage: boolean;
  items: Record<string, number>;
  time: string;
};

type Step = "pick" | "entry" | "review" | "success";

export function WorkerFlow({
  worker,
  customerGroups,
  categories,
  products,
  today,
  existing,
}: {
  worker: { name: string; code: string };
  customerGroups: CustomerGroup[];
  categories: Category[];
  products: Product[];
  today: string;
  existing: ExistingSubmission | null;
}) {
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const [step, setStep] = useState<Step>(existing ? "success" : "pick");
  const [date] = useState(today);
  const [group, setGroup] = useState<string | null>(existing?.group ?? null);
  const [noUsage, setNoUsage] = useState(existing?.noUsage ?? false);
  const [qty, setQty] = useState<Record<string, number>>(existing?.items ?? {});
  const [openCat, setOpenCat] = useState<string>(categories[0]?.id ?? "");
  const [time, setTime] = useState(existing?.time ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const setOne = (id: string, val: number | string) =>
    setQty((q) => {
      const n = { ...q };
      const v = Number(val) || 0;
      if (v) n[id] = v;
      else delete n[id];
      return n;
    });

  const total = sumQty(qty);
  const groupName = customerGroups.find((g) => g.id === group)?.name;

  const confirm = () => {
    setError(null);
    const lines = Object.entries(qty).map(([product_id, q]) => ({ product_id, qty: q }));
    start(async () => {
      const res = await submitUsage({ date, group, noUsage, lines });
      if (res.ok) {
        setTime(res.time ?? new Date().toTimeString().slice(0, 5));
        setStep("success");
      } else {
        setError(res.error || "ส่งข้อมูลไม่สำเร็จ");
      }
    });
  };

  return (
    <Shell>
      {step === "pick" && (
        <PickScreen
          worker={worker}
          date={date}
          customerGroups={customerGroups}
          onPick={(g) => {
            setGroup(g);
            setNoUsage(false);
            setStep("entry");
          }}
          onNoUsage={() => {
            setGroup(null);
            setNoUsage(true);
            setQty({});
            setStep("review");
          }}
        />
      )}

      {step === "entry" && (
        <EntryScreen
          categories={categories}
          products={products}
          qty={qty}
          setOne={setOne}
          openCat={openCat}
          setOpenCat={setOpenCat}
          groupName={groupName}
          total={total}
          onBack={() => setStep("pick")}
          onNext={() => setStep("review")}
        />
      )}

      {step === "review" && (
        <ReviewScreen
          date={date}
          group={group}
          groupName={groupName}
          noUsage={noUsage}
          qty={qty}
          byId={byId}
          customerGroups={customerGroups}
          error={error}
          pending={pending}
          onEdit={() => setStep(noUsage ? "pick" : "entry")}
          onConfirm={confirm}
        />
      )}

      {step === "success" && (
        <SuccessScreen
          worker={worker}
          groupName={groupName}
          noUsage={noUsage}
          total={total}
          time={time}
          onEdit={() => setStep(noUsage ? "pick" : "entry")}
        />
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

/* ---------- pick (date + customer group) ---------- */
function PickScreen({
  worker,
  date,
  customerGroups,
  onPick,
  onNoUsage,
}: {
  worker: { name: string; code: string };
  date: string;
  customerGroups: CustomerGroup[];
  onPick: (g: string) => void;
  onNoUsage: () => void;
}) {
  const fmt = new Date(date).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px 14px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.01em" }}>สวัสดี {worker.name}</div>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{worker.code}</div>
        </div>
        <LogoutBtn />
      </div>
      <div style={{ padding: "4px 18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <Label th="วันที่ใช้งาน" en="Usage date" />
          <div className="card" style={{ width: "100%", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
            <span style={{ color: "var(--accent)" }}><Icon name="calendar" size={22} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, textTransform: "capitalize" }}>{fmt}</div>
              <div className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{date} · วันนี้</div>
            </div>
          </div>
        </div>
        <div>
          <Label th="กลุ่มลูกค้า" en="Customer group · tap one" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            {customerGroups.map((g) => (
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
                <Icon name="chevR" size={20} style={{ color: "var(--ink-4)" }} />
              </button>
            ))}
            <button
              onClick={onNoUsage}
              className="focusable"
              style={{ padding: "15px 18px", display: "flex", alignItems: "center", gap: 14, textAlign: "left", borderRadius: 14, border: "1.5px dashed var(--border-2)", background: "transparent", color: "var(--ink-2)" }}
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
        </div>
      </div>
    </div>
  );
}

/* ---------- entry (grouped) ---------- */
function EntryScreen({
  categories,
  products,
  qty,
  setOne,
  openCat,
  setOpenCat,
  groupName,
  total,
  onBack,
  onNext,
}: {
  categories: Category[];
  products: Product[];
  qty: Record<string, number>;
  setOne: (id: string, v: number | string) => void;
  openCat: string;
  setOpenCat: (id: string) => void;
  groupName?: string;
  total: number;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 10px" }}>
          <button onClick={onBack} style={{ border: "none", background: "var(--surface-3)", borderRadius: 11, width: 38, height: 38, color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="chevL" size={20} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>กรอกจำนวนที่ใช้</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{groupName}</div>
          </div>
          <span className="pill blue tnum">{total} รายการรวม</span>
        </div>
      </div>

      <div style={{ padding: "14px 16px 120px", display: "flex", flexDirection: "column", gap: 12 }}>
        {categories.map((c) => {
          const groups = entryGroups(c, products);
          const items = groups.flatMap((g) => g.items);
          const open = openCat === c.id;
          const catTotal = items.reduce((s, p) => s + (qty[p.id] || 0), 0);
          return (
            <div key={c.id} className="card" style={{ overflow: "hidden" }}>
              <button
                onClick={() => setOpenCat(open ? "" : c.id)}
                className="focusable"
                style={{ width: "100%", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", textAlign: "left" }}
              >
                <Icon name="chevR" size={18} style={{ color: "var(--ink-4)", transform: open ? "rotate(90deg)" : "", transition: "transform .2s" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{c.name}</div>
                  <div className="en" style={{ fontSize: 11.5 }}>{c.name_en} · {items.length} รายการ</div>
                </div>
                {catTotal > 0 && <span className="pill blue tnum">{catTotal}</span>}
              </button>
              {open && (
                <div className="fade-up" style={{ borderTop: "1px solid var(--border)", padding: "4px 14px 14px" }}>
                  {c.viz === "rail" ? (
                    groups.map((g) => (
                      <div key={g.key} style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 }}>{g.label}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7 }}>
                          {g.items.map((p) => (
                            <div key={p.id}>
                              <div style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", marginBottom: 3 }}>{p.length}</div>
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
                    items.map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 2px", borderBottom: "1px solid var(--surface-3)" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{p.sku} · {p.unit}</div>
                        </div>
                        <Stepper value={qty[p.id] || 0} onChange={(v) => setOne(p.id, v)} />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
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

/* ---------- review ---------- */
function ReviewScreen({
  date,
  group,
  groupName,
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
  noUsage: boolean;
  qty: Record<string, number>;
  byId: Map<string, Product>;
  customerGroups: CustomerGroup[];
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
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>รวมทั้งหมด</div>
                {meters > 0 && <div className="en" style={{ fontSize: 11.5 }}>{meters} meters of rail</div>}
              </div>
              <div className="tnum" style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)" }}>{total}</div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--red-soft)", color: "var(--red-ink)", fontSize: 13, fontWeight: 600 }}>{error}</div>
        )}
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

/* ---------- success ---------- */
function SuccessScreen({
  worker,
  groupName,
  noUsage,
  total,
  time,
  onEdit,
}: {
  worker: { name: string; code: string };
  groupName?: string;
  noUsage: boolean;
  total: number;
  time: string;
  onEdit: () => void;
}) {
  const [pending, start] = useTransition();
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
          <RowKV k="ผู้บันทึก" v={`${worker.name} · ${worker.code}`} />
          <RowKV k="กลุ่มลูกค้า" v={noUsage ? "ไม่มีการใช้งาน" : groupName ?? ""} />
          <RowKV k="จำนวนรวม" v={noUsage ? "—" : `${total} รายการ`} />
          <RowKV k="เวลาส่ง" v={time} mono />
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="chat" size={15} style={{ color: "var(--green)" }} /> ระบบบันทึกการใช้และตัดสต็อกแล้ว
        </div>
      </div>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
        <Btn kind="soft" size="lg" full onClick={onEdit} icon="edit">
          แก้ไขข้อมูลวันนี้ <span className="en">Edit today</span>
        </Btn>
        <Btn kind="primary" size="lg" full disabled={pending} onClick={() => start(() => workerSignOut())}>
          เสร็จสิ้น · ออกจากระบบ <span className="en" style={{ color: "rgba(255,255,255,.7)" }}>Done</span>
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
