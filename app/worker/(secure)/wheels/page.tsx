import Link from "next/link";
import { getWorkerSession } from "@/lib/worker-session";
import { Icon, type IconName } from "@/components/icon";

/** Worker SC Wheels home — choose a production workflow (packing / assembly). */
export default async function WorkerWheelsHome() {
  const session = (await getWorkerSession())!; // layout guarantees non-null

  const cards: { href: string; icon: IconName; th: string; desc: string }[] = [
    { href: "/worker/wheels/packing", icon: "box", th: "แพ็คกล่อง", desc: "บันทึกจำนวนกล่องที่แพ็คเสร็จ · ระบบหักล้อดิบให้อัตโนมัติ" },
    { href: "/worker/wheels/assembly", icon: "layers", th: "ประกอบสินค้า", desc: "บันทึกจำนวนสินค้าที่ประกอบเสร็จ · ระบบหักวัตถุดิบตาม BOM ให้อัตโนมัติ" },
  ];

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 18px 32px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>SC Wheels · บันทึกการผลิต</div>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>
          {session.name} ({session.code}) · กรอกเฉพาะจำนวนที่ผลิตเสร็จ
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="card focusable"
            style={{ padding: 20, display: "flex", alignItems: "center", gap: 16, textDecoration: "none", color: "var(--ink)" }}
          >
            <span style={{ width: 52, height: 52, borderRadius: 14, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <Icon name={c.icon} size={26} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{c.th}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.5 }}>{c.desc}</div>
            </div>
            <Icon name="chevR" size={22} style={{ color: "var(--ink-4)" }} />
          </Link>
        ))}
      </div>
    </div>
  );
}
