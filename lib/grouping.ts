import type { Category, Product } from "@/lib/types";

/* ============================================================================
 *  Rail grouping — the ONE source of truth for how rails are split into
 *  labelled groups across the whole app (inventory board, reports, stock
 *  entry, dashboard). Rails group by VARIANT → SIZE, so a model like GI gets
 *  its own clearly-labelled section instead of being merged into a plain size.
 *
 *  To make a rail its own group (e.g. "ราง Gi"), set the product's Variant
 *  field. Grouping is display-only; storage always stays SKU-level.
 * ==========================================================================*/

const norm = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** Stable grouping key for a rail, e.g. "GI|1\"" or "|2\"" (no variant). */
export function railKey(variant: string | null | undefined, size: string | null | undefined): string {
  return `${norm(variant) ?? ""}|${norm(size) ?? "—"}`;
}

/** Human label for a rail group, e.g. "ราง 1\"", "ราง Gi 1\"", "ราง (ไม่ระบุขนาด)". */
export function railLabel(variant: string | null | undefined, size: string | null | undefined): string {
  const v = norm(variant);
  const sizePart = norm(size) ?? "(ไม่ระบุขนาด)";
  return v ? `ราง ${v} ${sizePart}` : `ราง ${sizePart}`;
}

/** Which rail bucket a single product/row belongs to (key + label together). */
export function railBucket(variant: string | null | undefined, size: string | null | undefined) {
  return { key: railKey(variant, size), label: railLabel(variant, size) };
}

export type RailGroup = {
  key: string;
  variant: string | null;
  size: string | null; // null when unknown
  label: string;
  en: string;
  unit: string;
  minOrder: number;
  items: Product[]; // sorted by length
};

/** Split a list of rail products into ordered, labelled groups. */
export function railGroups(products: Product[]): RailGroup[] {
  const map = new Map<string, RailGroup>();
  for (const p of products) {
    const variant = norm(p.variant);
    const size = norm(p.size);
    const key = railKey(variant, size);
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        variant,
        size,
        label: railLabel(variant, size),
        en: variant ? `${variant} ${size ?? ""}`.trim() : size ? `Rail ${size}` : "Other rails",
        unit: p.unit ?? "",
        minOrder: p.display_order,
        items: [],
      };
      map.set(key, g);
    }
    g.items.push(p);
    if (p.display_order < g.minOrder) g.minOrder = p.display_order;
  }
  return [...map.values()]
    .sort((a, b) => a.minOrder - b.minOrder)
    .map((g) => ({ ...g, items: g.items.slice().sort((a, b) => (a.length_m ?? 0) - (b.length_m ?? 0)) }));
}

export type EntryGroup = {
  key: string;
  label: string;
  en: string;
  unit: string;
  items: Product[];
};

/**
 * Reusable grouped-entry logic shared by Stock Input (receiving) and Stock
 * Output (worker daily usage), so both screens present a consistent UI.
 *
 *  - Rail categories (viz "rail") group via railGroups (variant → size).
 *  - Any other category falls back to a single ordered group.
 */
export function entryGroups(category: Category, products: Product[]): EntryGroup[] {
  const items = products.filter((p) => p.category_id === category.id && p.active);

  if (category.viz === "rail") {
    return railGroups(items).map((g) => ({ key: g.key, label: g.label, en: g.en, unit: g.unit, items: g.items }));
  }

  return [
    {
      key: category.id,
      label: category.name,
      en: category.name_en ?? "",
      unit: "",
      items: items.slice().sort((a, b) => a.display_order - b.display_order),
    },
  ];
}

/** Sum a {sku|id: qty} map. */
export function sumQty(map: Record<string, number>): number {
  return Object.values(map).reduce((a, b) => a + (Number(b) || 0), 0);
}

/** Total meters of rail for an id→qty map (qty × length_m). */
export function sumMeters(map: Record<string, number>, byId: Map<string, Product>): number {
  return Object.entries(map).reduce((m, [id, q]) => {
    const p = byId.get(id);
    return m + (p?.length_m ? p.length_m * (Number(q) || 0) : 0);
  }, 0);
}
