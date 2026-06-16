import type { IconName } from "@/components/icon";

export type NavItem = { id: string; th: string; en: string; icon: IconName; href: string; adminOnly?: boolean };
export type NavGroup = { group: string; items: NavItem[] };

/** A top-level module reachable from the admin module switcher. */
export type ModuleDef = { id: string; th: string; en: string; icon: IconName; home: string; nav: NavGroup[] };

/** Admin sidebar navigation (mirrors the prototype's NAV). */
export const NAV: NavGroup[] = [
  {
    group: "ภาพรวม",
    items: [
      { id: "dashboard", th: "แดชบอร์ด", en: "Dashboard", icon: "dashboard", href: "/admin" },
      { id: "inventory", th: "สต็อกปัจจุบัน", en: "Current Inventory", icon: "grid", href: "/admin/inventory" },
      { id: "lowstock", th: "สต็อกใกล้หมด", en: "Low Stock", icon: "alert", href: "/admin/low-stock" },
      { id: "reports", th: "รายงาน", en: "Reports", icon: "chart", href: "/admin/reports" },
    ],
  },
  {
    group: "จัดการสต็อก",
    items: [
      { id: "stockin", th: "รับสินค้าเข้า", en: "Stock Input", icon: "download", href: "/admin/stock-input" },
      { id: "adjust", th: "ปรับปรุงสต็อก", en: "Adjustments", icon: "sliders", href: "/admin/adjustments" },
    ],
  },
  {
    group: "ตั้งค่าข้อมูล",
    items: [
      { id: "products", th: "สินค้า", en: "Products", icon: "box", href: "/admin/products" },
      { id: "categories", th: "หมวดหมู่", en: "Categories", icon: "layers", href: "/admin/categories" },
      { id: "groups", th: "กลุ่มลูกค้า", en: "Customer Groups", icon: "users", href: "/admin/customer-groups" },
      { id: "pins", th: "PIN พนักงาน", en: "Worker PINs", icon: "key", href: "/admin/workers" },
      { id: "line", th: "ตั้งค่า LINE", en: "LINE Settings", icon: "chat", href: "/admin/line" },
    ],
  },
];

/** SC Wheels module sidebar navigation (Phase 1 — catalog only). */
export const WHEELS_NAV: NavGroup[] = [
  {
    group: "ภาพรวม",
    items: [{ id: "wheels-home", th: "ภาพรวม SC Wheels", en: "Overview", icon: "dashboard", href: "/admin/wheels" }],
  },
  {
    group: "การเคลื่อนไหวสต็อก",
    items: [
      { id: "wheels-receiving", th: "รับล้อดิบเข้า", en: "Raw Receiving", icon: "download", href: "/admin/wheels/receiving" },
      { id: "wheels-sales", th: "บันทึกการขาย", en: "Sales", icon: "store", href: "/admin/wheels/sales" },
      { id: "wheels-raw-sales", th: "ขายล้อดิบ (พิเศษ)", en: "Raw-Wheel Sale", icon: "bolt", href: "/admin/wheels/raw-sales", adminOnly: true },
    ],
  },
  {
    group: "แคตตาล็อกสินค้า",
    items: [
      { id: "wheels-raw", th: "ล้อดิบ", en: "Raw Wheels", icon: "settings", href: "/admin/wheels/raw" },
      { id: "wheels-boxes", th: "กล่องบรรจุ", en: "Packed Boxes", icon: "box", href: "/admin/wheels/boxes" },
      { id: "wheels-assemblies", th: "สินค้าประกอบ", en: "Assemblies", icon: "layers", href: "/admin/wheels/assemblies" },
      { id: "wheels-attributes", th: "ตั้งค่าคุณสมบัติ", en: "Attributes", icon: "sliders", href: "/admin/wheels/attributes", adminOnly: true },
    ],
  },
];

/**
 * Top-level modules sharing the admin shell. The module switcher in the
 * sidebar lets the admin move between SC Inventory and SC Wheels; each module
 * brings its own nav (above). SC Inventory's screens are unchanged.
 */
export const MODULES: ModuleDef[] = [
  { id: "inventory", th: "SC Inventory", en: "Inventory", icon: "grid", home: "/admin", nav: NAV },
  { id: "wheels", th: "SC Wheels", en: "Manufacturing", icon: "settings", home: "/admin/wheels", nav: WHEELS_NAV },
];

/** Resolve which module owns a given pathname (defaults to SC Inventory). */
export function moduleForPath(pathname: string): ModuleDef {
  return pathname.startsWith("/admin/wheels") ? MODULES[1] : MODULES[0];
}

/** Per-category icon + accent colour (matches the prototype). */
export const CAT_ICON: Record<string, IconName> = {
  rails: "grid",
  screws: "settings",
  paint: "box",
  parts: "bolt",
  consumables: "layers",
};
export const CAT_COLOR: Record<string, string> = {
  rails: "#2563eb",
  screws: "#0f9d6b",
  paint: "#e08a00",
  parts: "#7a5ae0",
  consumables: "#0e8f8f",
};

export const GROUP_ICON: Record<string, IconName> = {
  bkk: "store",
  upc: "pin2",
  truck: "truck",
  modern: "store",
};
export const GROUP_COLOR: Record<string, string> = {
  bkk: "#2563eb",
  upc: "#0f9d6b",
  truck: "#e08a00",
  modern: "#7a5ae0",
};
export const SIZE_COLOR: Record<string, string> = {
  '1"': "#2563eb",
  '2"': "#0f9d6b",
  '3"': "#e08a00",
};
