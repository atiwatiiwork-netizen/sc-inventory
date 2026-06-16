// SC Wheels — Wooden Crate Inventory v1 shared types (Phase 6).
// PURE module (no server imports). Mirrors supabase/wheels-phase6.sql.
//
// PASSIVE VISIBILITY ONLY: crate quantities are maintained by humans and are
// intentionally disconnected from the stock movement engine. Nothing here
// deducts, consumes, or links to transactions/production/sales.

/** One crate-inventory record (one per raw-wheel SKU). */
export type WheelCrate = {
  id: string;
  raw_id: string;
  pieces_per_crate: number;
  crate_qty: number;
  note: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** A manual adjustment to a crate's quantity (history). */
export type WheelCrateMove = {
  id: string;
  crate_id: string;
  delta: number;
  before_qty: number;
  after_qty: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

/** Approximate loose wheels represented by the crates on hand. Display only. */
export function approxPieces(c: Pick<WheelCrate, "crate_qty" | "pieces_per_crate">): number {
  return Math.max(0, c.crate_qty) * Math.max(0, c.pieces_per_crate);
}
