import type { IconName } from "@/components/icon";

/* ============================================================================
 *  SC Wheels — worker function registry.
 *
 *  `key` values are IMMUTABLE internal identifiers (referenced by
 *  wheels_function_roles.function_key). They define which SC Wheels worker-area
 *  functions exist and can be role-gated. This is "function availability"
 *  control, not ERP-style permissions.
 * ==========================================================================*/

export type WheelsWorkerFunction = {
  key: string;
  th: string;
  en: string;
  href: string;
  icon: IconName;
  desc: string;
  /**
   * Default-OPEN (the model default): a function with no role mapping is allowed
   * for everyone. Set `defaultClosed` for sensitive functions (e.g. sales entry)
   * that must be DENIED unless a role is explicitly mapped.
   */
  defaultClosed?: boolean;
};

export const WHEELS_WORKER_FUNCTIONS: WheelsWorkerFunction[] = [
  {
    key: "wheels-packing",
    th: "แพ็คกล่อง",
    en: "Packing",
    href: "/worker/wheels/packing",
    icon: "box",
    desc: "บันทึกจำนวนกล่องที่แพ็คเสร็จ · ระบบหักล้อดิบให้อัตโนมัติ",
  },
  {
    key: "wheels-assembly",
    th: "ประกอบสินค้า",
    en: "Assembly",
    href: "/worker/wheels/assembly",
    icon: "layers",
    desc: "บันทึกจำนวนสินค้าที่ประกอบเสร็จ · ระบบหักวัตถุดิบตาม BOM ให้อัตโนมัติ",
  },
  {
    key: "wheels-stock-check",
    th: "เช็คสต็อกพร้อมขาย",
    en: "Stock Check",
    href: "/worker/wheels/stock-check",
    icon: "grid",
    desc: "ดูสต็อกสินค้าสำเร็จรูป (กล่องบรรจุ) ที่มีอยู่จริงตอนนี้",
  },
  {
    // Read-only on the worker side (passive visibility). Default-open.
    key: "wheels-work-plan",
    th: "แผนงานโรงงาน",
    en: "Work Plan",
    href: "/worker/wheels/work-plan",
    icon: "calendar",
    desc: "ดูแผนงานวันนี้และพรุ่งนี้ของโรงงาน (ดูอย่างเดียว)",
  },
  {
    // Sales entry is sensitive — DENIED unless the owner maps a role to it.
    key: "wheels-sales",
    th: "บันทึกการขาย",
    en: "Sales Entry",
    href: "/worker/wheels/sales",
    icon: "store",
    desc: "ดูรายการขายที่บันทึกไว้ และเพิ่มรายการขายใหม่ (เฉพาะผู้ที่ได้รับสิทธิ์)",
    defaultClosed: true,
  },
];

export const wheelsFunctionByKey = (key: string) => WHEELS_WORKER_FUNCTIONS.find((f) => f.key === key);
