// Domain types mirroring the database schema (supabase/schema.sql).

export type Category = {
  id: string;
  name: string;
  name_en: string | null;
  display_order: number;
  report_unit: string | null;
  report_unit_th: string | null;
  secondary_unit: string | null;
  secondary_unit_th: string | null;
  viz: string | null;
  active: boolean;
  archived: boolean;
  worker_entry: boolean;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  name_en: string | null;
  category_id: string | null;
  unit: string | null;
  unit_en: string | null;
  variant: string | null;
  size: string | null;
  length: string | null;
  length_m: number | null;
  stock: number;
  min_stock: number;
  display_order: number;
  description: string | null;
  active: boolean;
  archived: boolean;
};

export type CustomerGroup = {
  id: string;
  name: string;
  name_en: string | null;
  active: boolean;
};

export type Worker = {
  id: string;
  code: string;
  name: string;
  name_en: string | null;
  pin: string;
  active: boolean;
};

export type ReportUnit = { id: string; th: string; sort: number };
export type VizType = { id: string; th: string; en: string };

export type WorkerSession = {
  id: string;
  code: string;
  name: string;
};

export type StockStatus = "green" | "amber" | "red";

/** Traffic-light status — matches the prototype's stockStatus(). */
export function stockStatus(p: Pick<Product, "stock" | "min_stock">): StockStatus {
  if (p.stock < p.min_stock) return "red";
  if (p.stock <= p.min_stock * 1.2) return "amber";
  return "green";
}
