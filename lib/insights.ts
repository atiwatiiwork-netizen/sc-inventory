// Dynamic consumption insights — INFORMATIONAL ONLY.
// These never change the red/amber/green alert colours (those come from the
// static min_stock thresholds in stockStatus()). They are decision support:
// average daily usage and estimated days of cover, derived from real stock-out
// movements. No forecasting, no lead-time settings, no replenishment logic.

/** Fixed lookback window for the rolling average (a constant, not a setting). */
export const LOOKBACK_DAYS = 30;

export type MovementProduct = {
  sku: string;
  name: string;
  category_id: string | null;
  length_m: number | null;
  size: string | null;
  unit: string | null;
};

/** One stock-out movement (worker usage). qty is negative. */
export type Movement = {
  product_id: string;
  txn_date: string;
  qty: number;
  product: MovementProduct | null;
};

export type Consumption = { used: number; avgDaily: number };

/** Aggregate used quantity per product over the window → average daily usage. */
export function buildConsumption(movements: Movement[], days = LOOKBACK_DAYS): Record<string, Consumption> {
  const out: Record<string, Consumption> = {};
  for (const m of movements) {
    const used = Math.abs(m.qty);
    const c = (out[m.product_id] ??= { used: 0, avgDaily: 0 });
    c.used += used;
  }
  for (const c of Object.values(out)) c.avgDaily = c.used / days;
  return out;
}

/** Estimated days of cover = stock ÷ average daily usage. null when no usage. */
export function daysOfCover(stock: number, avgDaily: number): number | null {
  if (!avgDaily || avgDaily <= 0) return null;
  return stock / avgDaily;
}

/** Short human label for days of cover. */
export function coverLabel(stock: number, avgDaily: number): string {
  const d = daysOfCover(stock, avgDaily);
  if (d === null) return "—";
  if (d >= 999) return "999+ วัน";
  return `${d < 10 ? d.toFixed(1) : Math.round(d)} วัน`;
}

/** Convert a raw quantity into a category's reporting unit (meters for rails). */
export function inUnit(reportUnit: string | null | undefined, qty: number, lengthM: number | null): number {
  return reportUnit === "m" && lengthM ? lengthM * qty : qty;
}
