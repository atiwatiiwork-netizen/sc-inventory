import type { IconName } from "@/components/icon";

export type NavItem = { id: string; th: string; en: string; icon: IconName; href: string };
export type NavGroup = { group: string; items: NavItem[] };

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
