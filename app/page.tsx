import Link from "next/link";
import { Icon } from "@/components/icon";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* top bar — mirrors the prototype shell */}
      <header
        style={{
          height: 60,
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: "var(--ink)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            SC
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.1, whiteSpace: "nowrap" }}>
              ระบบจัดการสต็อก โรงงานรางเหล็ก
            </div>
            <div className="en" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
              Steel Rail Inventory Management
            </div>
          </div>
        </div>
      </header>

      {/* role chooser */}
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ width: "100%", maxWidth: 720 }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-.02em" }}>เลือกบทบาทเพื่อเข้าใช้งาน</h1>
            <div className="en" style={{ fontSize: 14, marginTop: 4 }}>
              Choose how you want to sign in
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <RoleCard
              href="/worker/login"
              icon="user"
              th="พนักงาน"
              en="Worker"
              desc="บันทึกการใช้ประจำวันด้วย PIN 4 หลัก"
            />
            <RoleCard
              href="/admin/login"
              icon="dashboard"
              th="ผู้ดูแล"
              en="Administrator"
              desc="แดชบอร์ด จัดการสินค้า และรายงาน"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function RoleCard({
  href,
  icon,
  th,
  en,
  desc,
}: {
  href: string;
  icon: "user" | "dashboard";
  th: string;
  en: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="card focusable"
      style={{
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        textDecoration: "none",
        color: "var(--ink)",
      }}
    >
      <span
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: "var(--accent-soft)",
          color: "var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={26} />
      </span>
      <div>
        <div style={{ fontSize: 19, fontWeight: 700 }}>
          {th} <span className="en">{en}</span>
        </div>
        <div style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 4 }}>{desc}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--accent)", fontSize: 14, fontWeight: 600 }}>
        เข้าสู่ระบบ <Icon name="chevR" size={16} />
      </div>
    </Link>
  );
}
