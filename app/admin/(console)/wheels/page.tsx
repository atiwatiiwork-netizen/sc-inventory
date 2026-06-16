import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon, type IconName } from "@/components/icon";
import { ScreenHead } from "@/components/ui";

/** SC Wheels module landing — catalog counts + entry points (Phase 1). */
export default async function WheelsHome() {
  const supabase = await createClient();
  const [raw, boxes, assemblies] = await Promise.all([
    supabase.from("wheels_raw").select("stock").eq("archived", false),
    supabase.from("wheels_boxes").select("stock").eq("archived", false),
    supabase.from("wheels_assemblies").select("stock").eq("archived", false),
  ]);

  const tally = (rows: { stock: number }[] | null) => ({
    count: rows?.length ?? 0,
    stock: (rows ?? []).reduce((s, r) => s + (r.stock ?? 0), 0),
  });
  const rawT = tally(raw.data);
  const boxT = tally(boxes.data);
  const asmT = tally(assemblies.data);

  const cards: { href: string; icon: IconName; th: string; en: string; desc: string; count: number; stock: number; unit: string }[] = [
    {
      href: "/admin/wheels/raw",
      icon: "settings",
      th: "ล้อดิบ",
      en: "Raw Wheels",
      desc: "ผิวชุบ × ขนาด × ร่อง",
      count: rawT.count,
      stock: rawT.stock,
      unit: "ลูก",
    },
    {
      href: "/admin/wheels/boxes",
      icon: "box",
      th: "กล่องบรรจุ",
      en: "Packed Boxes",
      desc: "อ้างอิงล้อดิบ + จำนวนต่อกล่อง",
      count: boxT.count,
      stock: boxT.stock,
      unit: "กล่อง",
    },
    {
      href: "/admin/wheels/assemblies",
      icon: "layers",
      th: "สินค้าประกอบ",
      en: "Assemblies",
      desc: "สินค้าสำเร็จรูป กำหนดด้วย BOM",
      count: asmT.count,
      stock: asmT.stock,
      unit: "ชิ้น",
    },
  ];

  return (
    <div className="fade-up">
      <ScreenHead th="SC Wheels" en="โรงงานผลิตล้อ · แบบผลิตเข้าสต็อก (Make to Stock)" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="card focusable"
            style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, textDecoration: "none", color: "var(--ink)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={c.icon} size={22} />
              </span>
              <span className="tnum" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.02em" }}>
                {c.count}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {c.th} <span className="en" style={{ fontSize: 12 }}>{c.en}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 3 }}>{c.desc}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, color: "var(--ink-3)" }}>
              <span>
                คงเหลือ <span className="tnum" style={{ fontWeight: 700, color: c.stock < 0 ? "var(--red-ink)" : "var(--ink)" }}>{c.stock.toLocaleString()}</span> {c.unit}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--accent)", fontWeight: 600 }}>
                {c.count} SKU <Icon name="chevR" size={15} />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 18, fontSize: 12.5, color: "var(--ink-4)", lineHeight: 1.6 }}>
        Phase 1 — แคตตาล็อกสินค้าเท่านั้น · การบันทึกการผลิต (พนักงาน) และการขาย (ออฟฟิศ) จะเพิ่มในเฟสถัดไป
      </div>
    </div>
  );
}
