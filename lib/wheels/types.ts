// SC Wheels domain types — mirror supabase/wheels-phase1.sql.
// Kept separate from lib/types.ts so the SC Wheels module stays self-contained.

/** Extensible attribute lookup (finish / size / groove). */
export type WheelLookup = { id: string; th: string; en: string; sort: number };

/** A worker role (one per worker). `is_system` marks the protected default ('general'). */
export type WorkerRole = { id: string; name: string; name_en: string | null; sort: number; active: boolean; is_system: boolean };

/** A raw wheel SKU — uniquely defined by finish × size × groove. */
export type WheelRaw = {
  id: string;
  sku: string;
  name: string | null;
  finish: string; // → wheels_finishes.id
  size: string; // → wheels_sizes.id
  groove: string; // → wheels_grooves.id
  unit: string;
  stock: number; // Phase 2 balance
  min_stock: number;
  display_order: number;
  active: boolean;
  archived: boolean;
};

/** A packed box SKU — references a raw wheel, packs N units per box. */
export type WheelBox = {
  id: string;
  sku: string;
  name: string | null;
  raw_id: string;
  units_per_box: number;
  unit: string;
  stock: number; // Phase 2 balance
  min_stock: number;
  display_order: number;
  active: boolean;
  archived: boolean;
};

/** A finished assembly product — defined through a BOM, not as a wheel variant. */
export type WheelAssembly = {
  id: string;
  sku: string;
  name: string;
  name_en: string | null;
  unit: string;
  stock: number; // Phase 2 balance
  min_stock: number;
  display_order: number;
  active: boolean;
  archived: boolean;
};

/** The three independent inventory layers (Phase 2). */
export type InventoryLayer = "raw" | "box" | "assembly";

/** A shortage line returned by a movement RPC when stock would go negative. */
export type Shortage = {
  layer: InventoryLayer;
  ref_id: string;
  sku: string;
  have: number;
  need: number;
  short: number;
};

/**
 * Shared result of a movement server action. `shortages` is present only when a
 * soft-block fired; admins may retry with an override + reason.
 */
export type MovementResult = { ok: boolean; error?: string; shortages?: Shortage[] };

export type BomComponentType = "raw" | "box" | "part";

/** One line of an assembly's bill of materials. */
export type WheelBomLine = {
  id: string;
  assembly_id: string;
  component_type: BomComponentType;
  raw_id: string | null;
  box_id: string | null;
  part_name: string | null;
  qty: number;
  unit: string | null;
  sort: number;
};
