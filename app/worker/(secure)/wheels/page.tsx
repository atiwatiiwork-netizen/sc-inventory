import Link from "next/link";
import { getWorkerSession } from "@/lib/worker-session";
import { getWheelsAccess } from "@/lib/wheels/worker-access";
import { WHEELS_WORKER_FUNCTIONS } from "@/lib/wheels/worker-functions";
import { Icon } from "@/components/icon";

/** Worker SC Wheels home — shows only the functions this worker's role may use. */
export default async function WorkerWheelsHome() {
  const session = (await getWorkerSession())!; // layout guarantees non-null
  const access = await getWheelsAccess(session.id);
  const fns = WHEELS_WORKER_FUNCTIONS.filter((f) => f.menu !== false && access[f.key]);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 18px 32px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>SC Wheels · บันทึกการผลิต</div>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>
          {session.name} ({session.code})
        </div>
      </div>
      {fns.length === 0 ? (
        <div className="card" style={{ padding: 18, color: "var(--ink-3)", fontSize: 14 }}>
          บัญชีของคุณยังไม่ได้รับสิทธิ์ใช้งานฟังก์ชันใน SC Wheels — ติดต่อผู้ดูแลเพื่อกำหนดสิทธิ์
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {fns.map((f) => (
            <Link
              key={f.key}
              href={f.href}
              className="card focusable"
              style={{ padding: 20, display: "flex", alignItems: "center", gap: 16, textDecoration: "none", color: "var(--ink)" }}
            >
              <span style={{ width: 52, height: 52, borderRadius: 14, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <Icon name={f.icon} size={26} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{f.th}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.5 }}>{f.desc}</div>
              </div>
              <Icon name="chevR" size={22} style={{ color: "var(--ink-4)" }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
