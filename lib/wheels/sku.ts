import type { WheelLookup, WheelRaw } from "@/lib/wheels/types";

/* ============================================================================
 *  SC Wheels — display + SKU helpers (display-only; storage stays explicit).
 * ==========================================================================*/

const label = (rows: WheelLookup[], id: string) => rows.find((r) => r.id === id)?.en ?? id;

/** Human label for a raw wheel, e.g. "Chrome 3" Round". */
export function rawWheelLabel(
  raw: Pick<WheelRaw, "finish" | "size" | "groove">,
  finishes: WheelLookup[],
  sizes: WheelLookup[],
  grooves: WheelLookup[],
): string {
  return `${label(finishes, raw.finish)} ${label(sizes, raw.size)} ${label(grooves, raw.groove)}`;
}

/** Auto-slug a lookup id from a label (lowercase, url-ish). */
export function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Suggested SKU from finish × size × groove, e.g. "WHL-CHR-3-RND".
 * Editable — admins can override the suggestion in the form.
 */
export function suggestRawSku(finish: string, size: string, groove: string): string {
  if (!finish || !size || !groove) return "";
  const f = finish.slice(0, 3).toUpperCase();
  const s = size.replace(/[^a-z0-9.]/gi, "").toUpperCase();
  const g = groove.slice(0, 3).toUpperCase();
  return `WHL-${f}-${s}-${g}`;
}

/** Suggested packed-box SKU from a raw wheel's coordinates + units, e.g. "BOX-CHR-3-U-50". */
export function suggestBoxSku(finish: string, size: string, groove: string, units: number): string {
  if (!finish || !size || !groove) return "";
  const f = finish.slice(0, 3).toUpperCase();
  const s = size.replace(/[^a-z0-9.]/gi, "").toUpperCase();
  const g = groove.slice(0, 3).toUpperCase();
  return `BOX-${f}-${s}-${g}-${units || 0}`;
}
