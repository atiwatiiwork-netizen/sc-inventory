import { Icon, type IconName } from "@/components/icon";
import { ScreenHead } from "@/components/ui";

export function ComingSoon({ th, en, phase, icon = "doc" }: { th: string; en: string; phase: string; icon?: IconName }) {
  return (
    <div className="fade-up">
      <ScreenHead th={th} en={en} />
      <div
        className="card"
        style={{
          padding: "44px 28px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "var(--accent-soft)",
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={28} />
        </span>
        <div style={{ fontSize: 18, fontWeight: 700 }}>หน้านี้จะเปิดใช้งานใน{phase}</div>
        <div style={{ fontSize: 13.5, color: "var(--ink-3)", maxWidth: 420, lineHeight: 1.6 }}>
          ฟีเจอร์นี้อยู่ในแผนการพัฒนาเป็นเฟส · เฟส 1 ครอบคลุมการตั้งค่าระบบ การเข้าสู่ระบบ การจัดการหมวดหมู่และสินค้า
        </div>
        <span className="pill blue" style={{ marginTop: 4 }}>
          {phase}
        </span>
      </div>
    </div>
  );
}
