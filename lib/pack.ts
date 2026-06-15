import type { Product } from "@/lib/types";

type PackInfo = { pack_unit: string | null; pack_size: number | null; unit: string | null };

/** Base units per pack (1 = no packaging). */
export function packSize(p: PackInfo): number {
  return p.pack_size && p.pack_size > 1 ? p.pack_size : 1;
}

/** Whether the product is counted in a pack unit (มัด/ลัง). */
export function hasPack(p: PackInfo): boolean {
  return packSize(p) > 1 && !!p.pack_unit;
}

/** The unit a worker enters in (pack unit if packaged, else base unit). */
export function entryUnit(p: PackInfo): string {
  return hasPack(p) ? p.pack_unit! : p.unit ?? "";
}

/** base quantity → packs (whole), for displaying a stored value in the input. */
export function toPacks(base: number, p: PackInfo): number {
  return Math.round(base / packSize(p));
}

/** packs → base quantity, for storing what the worker typed. */
export function toBase(packs: number, p: PackInfo): number {
  return packs * packSize(p);
}

/** "12 มัด (= 72 เส้น)" style label, or just "72 เส้น" when not packaged. */
export function packLabel(base: number, p: Product): string {
  if (!hasPack(p)) return `${base} ${p.unit ?? ""}`;
  return `${toPacks(base, p)} ${p.pack_unit} (= ${base} ${p.unit ?? ""})`;
}
