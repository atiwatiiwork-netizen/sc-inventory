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
    // distinct sizes ordered by their smallest display_order
    const order = new Map<string, number>();
    for (const p of items) {
      const size = p.size ?? "—";
      const cur = order.get(size);
      if (cur === undefined || p.display_order < cur) order.set(size, p.display_order);
    }
    const sizes = [...order.keys()].sort((a, b) => (order.get(a)! - order.get(b)!));
    return sizes.map((size) => ({
      key: size,
      label: `ราง ${size}`,
      en: `Rail ${size}`,
      unit: items.find((p) => p.size === size)?.unit ?? "",
      items: items
        .filter((p) => (p.size ?? "—") === size)
        .sort((a, b) => (a.length_m ?? 0) - (b.length_m ?? 0)),
    }));
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
