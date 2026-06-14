import type { Category, Product } from "@/lib/types";

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
 *  - Categories whose viz is "rail" group by size (each size shows its lengths
 *    together), e.g. ราง 1" → 1m / 2m / 3m / 4m.
 *  - Any other category falls back to a single ordered group.
 *
 * The grouping is display-only; storage stays SKU-level.
 */
export function entryGroups(category: Category, products: Product[]): EntryGroup[] {
  const items = products.filter((p) => p.category_id === category.id && p.active);

  if (category.viz === "rail") {
    // group by variant (model) → size, so different rail models (e.g. GI) get
    // their own clearly-labelled section. Standard rails (no variant) come first.
    type G = { variant: string | null; size: string; minOrder: number; items: Product[] };
    const map = new Map<string, G>();
    for (const p of items) {
      const variant = p.variant && p.variant.trim() ? p.variant.trim() : null;
      const size = p.size ?? "—";
      const k = `${variant ?? ""}|${size}`;
      let g = map.get(k);
      if (!g) {
        g = { variant, size, minOrder: p.display_order, items: [] };
        map.set(k, g);
      }
      g.items.push(p);
      if (p.display_order < g.minOrder) g.minOrder = p.display_order;
    }
    return [...map.values()]
      .sort((a, b) => a.minOrder - b.minOrder)
      .map((g) => {
        const sizePart = g.size === "—" ? "(ไม่ระบุขนาด)" : g.size;
        return {
          key: `${g.variant ?? ""}|${g.size}`,
          label: g.variant ? `ราง ${g.variant} ${sizePart}` : `ราง ${sizePart}`,
          en: g.variant ? `${g.variant} ${g.size === "—" ? "" : g.size}`.trim() : g.size === "—" ? "Other rails" : `Rail ${g.size}`,
          unit: g.items[0]?.unit ?? "",
          items: g.items.sort((a, b) => (a.length_m ?? 0) - (b.length_m ?? 0)),
        };
      });
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
