import type { Product } from "@/lib/types";
import { stockStatus } from "@/lib/types";

export type BarDatum = { label: string; value: number; color?: string };

/* ---- mini bar chart --------------------------------------- */
export function MiniBars({ data, color = "var(--accent)", height = 130 }: { data: BarDatum[]; color?: string; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height, padding: "6px 2px 0" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
          <div className="tnum" style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)" }}>{d.value}</div>
          <div
            style={{
              width: "100%",
              maxWidth: 46,
              height: `${(d.value / max) * 100}%`,
              minHeight: d.value ? 6 : 2,
              background: d.color || color,
              borderRadius: "7px 7px 3px 3px",
              transition: "height .5s cubic-bezier(.2,.7,.2,1)",
            }}
          />
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600, textAlign: "center", whiteSpace: "nowrap" }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ---- horizontal segment bars ------------------------------ */
export function SegBars({ data }: { data: BarDatum[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>{d.label}</span>
            <span className="tnum" style={{ fontSize: 13, fontWeight: 700 }}>{d.value}</span>
          </div>
          <div style={{ height: 9, borderRadius: 99, background: "var(--surface-3)", overflow: "hidden" }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: "100%", background: d.color || "var(--accent)", borderRadius: 99, transition: "width .5s cubic-bezier(.2,.7,.2,1)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- donut ------------------------------------------------ */
export function Donut({ data, size = 140 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", flex: "none" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="16" />
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * c;
          const off = acc * c;
          acc += frac;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth="16"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-off}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: d.color, flex: "none" }} />
            <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>{d.label}</span>
            <span className="tnum" style={{ color: "var(--ink-3)", marginLeft: "auto" }}>{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- traffic-light rail board (grouped by rail type) -------
 *  Each rail "type" is its own row — standard rails group by size
 *  ("รางเหล็ก 1\""), special ones by variant ("ราง Gi", "ราง ดำ").
 *  Within a row we show ONE card per length that actually exists,
 *  length-sorted, so there are no empty matrix cells. New sizes or
 *  variants appear automatically as new rows. */
type RailGroup = { key: string; label: string; order: number; items: Product[] };

function groupRails(products: Product[]): RailGroup[] {
  const rails = products.filter((p) => p.size || p.variant || p.length_m != null);
  const groups = new Map<string, RailGroup>();
  for (const p of rails) {
    const variant = p.variant?.trim() || "";
    const size = p.size?.trim() || "";
    let key: string;
    let label: string;
    if (variant) { key = "v:" + variant; label = `ราง ${variant}`; }
    else if (size) { key = "s:" + size; label = `รางเหล็ก ${size}`; }
    else { key = "x:" + p.id; label = p.name; }
    const g = groups.get(key) ?? { key, label, order: p.display_order ?? 9999, items: [] };
    g.order = Math.min(g.order, p.display_order ?? 9999);
    g.items.push(p);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => a.order - b.order);
}

export function StatusMatrix({ products, compact }: { products: Product[]; compact?: boolean }) {
  const groups = groupRails(products);
  const w = compact ? 96 : 118;

  const lenSort = (a: Product, b: Product) =>
    (a.length_m ?? 1e9) - (b.length_m ?? 1e9) ||
    (a.size ?? "").localeCompare(b.size ?? "") ||
    (a.display_order ?? 0) - (b.display_order ?? 0);

  if (groups.length === 0) {
    return <div style={{ padding: 20, textAlign: "center", color: "var(--ink-4)", fontSize: 13.5 }}>ยังไม่มีข้อมูลราง</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 14 : 20 }}>
      {groups.map((g) => {
        const isVariant = g.key.startsWith("v:");
        const mixedSize = new Set(g.items.map((p) => p.size ?? "")).size > 1;
        const showSize = isVariant || mixedSize;
        return (
          <div key={g.key}>
            <div style={{ fontSize: compact ? 13 : 14.5, fontWeight: 700, color: "var(--ink)", marginBottom: 9 }}>{g.label}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {g.items.slice().sort(lenSort).map((p) => {
                const st = stockStatus(p);
                const bg = { green: "var(--green-soft)", amber: "var(--amber-soft)", red: "var(--red-soft)" }[st];
                const fg = { green: "var(--green-ink)", amber: "var(--amber-ink)", red: "var(--red-ink)" }[st];
                const parts: string[] = [];
                if (showSize && p.size) parts.push(p.size);
                parts.push(p.length || "—");
                return (
                  <div
                    key={p.id}
                    title={`${p.sku} · ${p.name}`}
                    style={{ width: w, background: bg, borderRadius: 12, padding: compact ? "9px 6px" : "12px 10px", textAlign: "center", border: `1px solid ${st === "red" ? "var(--red)" : "transparent"}` }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: fg, opacity: 0.85, marginBottom: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{parts.join(" · ")}</div>
                    <div className="tnum" style={{ fontSize: compact ? 19 : 25, fontWeight: 700, color: fg, lineHeight: 1 }}>{p.stock}</div>
                    <div style={{ fontSize: 10.5, color: fg, opacity: 0.72, marginTop: 3 }}>ขั้นต่ำ {p.min_stock}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Legend() {
  return (
    <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--ink-3)" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span className="dot green" /> ปกติ</span>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span className="dot amber" /> ใกล้หมด</span>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span className="dot red" /> ต่ำกว่าขั้นต่ำ</span>
    </div>
  );
}
