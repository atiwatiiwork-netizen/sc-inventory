"use client";

import { useState, useTransition } from "react";
import type { LineSettings } from "@/lib/line/settings-types";
import { buildDaily, buildWeekly, buildMonthly, buildLowstockAlert, buildWorkerCategory, type DailyData } from "@/lib/line/format";
import { SAMPLE_LOWSTOCK, SAMPLE_WEEKLY, SAMPLE_MONTHLY, SAMPLE_WORKERCAT } from "@/lib/line/samples";
import { Icon } from "@/components/icon";
import { Btn, Field, Panel, ScreenHead, SelectInput, TextInput, Toggle, inputStyle } from "@/components/ui";
import { saveLine, sendTest } from "@/app/admin/(console)/line/actions";

type PreviewTab = "daily" | "lowstock" | "weekly" | "monthly" | "worker";
const PREVIEW_TABS: { id: PreviewTab; label: string }[] = [
  { id: "daily", label: "รายวัน" },
  { id: "lowstock", label: "สต็อกต่ำ" },
  { id: "weekly", label: "รายสัปดาห์" },
  { id: "monthly", label: "รายเดือน" },
  { id: "worker", label: "ราย SKU พนักงาน" },
];

export function LineSettingsClient({ initial, preview }: { initial: LineSettings; preview: DailyData }) {
  const [f, setF] = useState<LineSettings>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<PreviewTab>("daily");

  function up<K extends keyof LineSettings>(key: K, value: LineSettings[K]) {
    setF((s) => ({ ...s, [key]: value }));
    setMsg(null);
  }

  const save = () =>
    start(async () => {
      const r = await saveLine(f);
      setMsg(r.ok ? { ok: true, text: "บันทึกการตั้งค่าแล้ว" } : { ok: false, text: r.error || "บันทึกไม่สำเร็จ" });
    });
  const test = () =>
    start(async () => {
      const r = await sendTest(f);
      setMsg(r.ok ? { ok: true, text: "ส่งข้อความทดสอบไปยัง LINE แล้ว" } : { ok: false, text: r.error || "ส่งทดสอบไม่สำเร็จ" });
    });

  const previewText =
    tab === "daily"
      ? buildDaily(preview, f)
      : tab === "lowstock"
        ? buildLowstockAlert(SAMPLE_LOWSTOCK, f)
        : tab === "weekly"
          ? buildWeekly(SAMPLE_WEEKLY, f)
          : tab === "monthly"
            ? buildMonthly(SAMPLE_MONTHLY, f)
            : buildWorkerCategory(SAMPLE_WORKERCAT, f);

  return (
    <div className="fade-up">
      <ScreenHead
        th="ตั้งค่า LINE"
        en="LINE Messaging Integration"
        right={
          <div style={{ display: "flex", gap: 10 }}>
            <Btn kind="default" icon="chat" size="sm" onClick={test} disabled={pending}>ส่งทดสอบ</Btn>
            <Btn kind="primary" icon="check" size="sm" onClick={save} disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึก"}</Btn>
          </div>
        }
      />

      {msg && (
        <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: msg.ok ? "var(--green-soft)" : "var(--red-soft)", color: msg.ok ? "var(--green-ink)" : "var(--red-ink)" }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* connection */}
          <Panel title="การเชื่อมต่อ" en="Connection">
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>เปิดใช้งาน LINE</div>
                <div className="en" style={{ fontSize: 12 }}>Enable LINE integration · ปิดแล้วจะไม่ส่งทุกชนิด</div>
              </div>
              <Toggle on={f.enabled} onChange={(v) => up("enabled", v)} />
            </label>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                padding: "12px 14px",
                marginBottom: 16,
                borderRadius: 10,
                background: "var(--surface-2)",
                opacity: f.enabled ? 1 : 0.5,
                pointerEvents: f.enabled ? "auto" : "none",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>ส่งรายงานอัตโนมัติตามเวลา</div>
                  <div className="en" style={{ fontSize: 11.5 }}>Scheduled auto reports · รายวัน/สัปดาห์/เดือน</div>
                </div>
                <Toggle on={f.autoSend} onChange={(v) => up("autoSend", v)} />
              </label>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>ให้พนักงานกดส่งสรุปเข้า LINE</div>
                  <div className="en" style={{ fontSize: 11.5 }}>Allow worker-initiated sends</div>
                </div>
                <Toggle on={f.workerSend} onChange={(v) => up("workerSend", v)} />
              </label>
            </div>

            <Field label="Channel Access Token" en="LINE Messaging API">
              <TextInput value={f.token} onChange={(e) => up("token", e.target.value)} placeholder="วาง token จาก LINE Developers" />
            </Field>
            <Field label="ปลายทาง (Group / User ID)" en="Recipient id">
              <TextInput value={f.recipientId} onChange={(e) => up("recipientId", e.target.value)} placeholder="Uxxxxxxxx หรือ Cxxxxxxxx" />
            </Field>
            <Field label="ชื่อปลายทาง (สำหรับแสดงผล)" en="Recipient name">
              <TextInput value={f.recipientName} onChange={(e) => up("recipientName", e.target.value)} />
            </Field>
          </Panel>

          {/* report format */}
          <Panel title="รูปแบบรายงาน" en="Report format">
            <Field label="ระดับรายละเอียด" en="Detail level">
              <SelectInput value={f.detail} onChange={(e) => up("detail", e.target.value as LineSettings["detail"])}>
                <option value="minimal">เฉพาะแจ้งเตือน + สถานะการส่ง</option>
                <option value="summary">สรุปตามหมวดหมู่ (แนะนำ)</option>
                <option value="detailed">สรุป + แยกขนาดราง (เมตร)</option>
              </SelectInput>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
              <Field label="การแจ้งเตือนสต็อกต่ำ" en="Low-stock mode">
                <SelectInput value={f.lowstockMode} onChange={(e) => up("lowstockMode", e.target.value as LineSettings["lowstockMode"])}>
                  <option value="digest">รวมในสรุปรายวัน (แนะนำ)</option>
                  <option value="immediate">ส่งแยกทันที</option>
                  <option value="off">ปิด</option>
                </SelectInput>
              </Field>
              <Field label="แสดงสูงสุด (SKU)" en="Max items">
                <TextInput inputMode="numeric" value={String(f.lowstockMax)} onChange={(e) => up("lowstockMax", Number(e.target.value.replace(/\D/g, "")) || 0)} />
              </Field>
            </div>
            <Field label="ข้อความหัว (กำหนดเอง)" en="Custom header · optional">
              <textarea value={f.headerText} onChange={(e) => up("headerText", e.target.value)} rows={2} placeholder="เช่น ชื่อโรงงาน / คำขึ้นต้น" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
            </Field>
            <Field label="ข้อความท้าย (กำหนดเอง)" en="Custom footer · optional">
              <textarea value={f.footerText} onChange={(e) => up("footerText", e.target.value)} rows={2} placeholder="เช่น เบอร์ติดต่อ / ลิงก์เว็บแอป" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
            </Field>
            <div style={{ display: "flex", gap: 9, padding: "11px 13px", borderRadius: 10, background: "var(--surface-3)", fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.6 }}>
              <Icon name="doc" size={15} style={{ flex: "none", marginTop: 1 }} />
              <span>รายงานสรุประดับหมวดหมู่ด้วยหน่วยของแต่ละหมวด · รายละเอียดราย SKU แสดงเฉพาะรายการสต็อกต่ำและ SKU ใช้มากสุดรายเดือน</span>
            </div>
          </Panel>

          {/* schedule */}
          <Panel title="กำหนดเวลาส่ง" en="Schedule">
            <Field label="ส่งสรุปรายวันเมื่อ" en="Daily trigger">
              <SelectInput value={f.dailyTrigger} onChange={(e) => up("dailyTrigger", e.target.value as LineSettings["dailyTrigger"])}>
                <option value="after">หลังพนักงานส่งข้อมูลครบ (มีเวลาสำรอง)</option>
                <option value="fixed">เฉพาะเวลาสำรองที่กำหนด</option>
              </SelectInput>
            </Field>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", fontSize: 13, color: "var(--ink-2)" }}>
              <Row icon="clock" label="รายวัน (เวลาสำรอง)" value="19:30 น." />
              <Row icon="calendar" label="รายสัปดาห์" value="จันทร์ 08:00 น." />
              <Row icon="calendar" label="รายเดือน" value="วันที่ 1 เวลา 08:00 น." />
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 8, lineHeight: 1.6 }}>
              ตารางนี้จะทำงานเฉพาะเมื่อเปิด <strong>&ldquo;ส่งรายงานอัตโนมัติตามเวลา&rdquo;</strong> ในส่วนการเชื่อมต่อ ·
              เวลาส่งกำหนดผ่าน Vercel Cron (ไฟล์ <span className="mono">vercel.json</span>) · การเปลี่ยนเวลาต้องแก้ไฟล์แล้ว deploy ใหม่ ·
              รายงานเป็นข้อความล้วน (ไม่ใช่รูปภาพ)
            </div>
          </Panel>
        </div>

        {/* live preview */}
        <div style={{ position: "sticky", top: 0 }}>
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: "#06C755", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="chat" size={17} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>ตัวอย่างข้อความ LINE</div>
                <div className="en" style={{ fontSize: 11.5 }}>Live preview</div>
              </div>
              <span className="pill grey">{f.recipientName || "ผู้รับ"}</span>
            </div>
            {/* message-type selector */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
              {PREVIEW_TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: "5px 11px",
                    borderRadius: 99,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "1px solid " + (tab === t.id ? "var(--accent)" : "var(--border-2)"),
                    background: tab === t.id ? "var(--accent)" : "var(--surface)",
                    color: tab === t.id ? "#fff" : "var(--ink-2)",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ padding: 18, background: "#8aa9c9", display: "flex", justifyContent: "flex-start" }}>
              <div className="mono" style={{ background: "#fff", borderRadius: "4px 16px 16px 16px", padding: "14px 16px", maxWidth: 360, boxShadow: "0 1px 2px rgba(0,0,0,.15)", fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {previewText}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 10, lineHeight: 1.6, padding: "0 2px" }}>
            {tab === "daily" ? "รายวันใช้ข้อมูลจริงของวันนี้" : "ตัวอย่างนี้เป็นข้อมูลสมมุติเพื่อดูรูปแบบ"} · เปลี่ยนการตั้งค่าด้านซ้าย (เช่น ข้อความหัว/ท้าย) เพื่อดูผลทันที แล้วกด &ldquo;บันทึก&rdquo;
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: "clock" | "calendar"; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <Icon name={icon} size={15} style={{ color: "var(--ink-4)", flex: "none" }} />
      <span style={{ flex: 1 }}>{label}</span>
      <span className="mono" style={{ fontWeight: 600, color: "var(--ink)" }}>{value}</span>
    </div>
  );
}
