"use client";

import { Icon, type IconName } from "@/components/icon";
import type { CSSProperties, ReactNode } from "react";

/* ---- Button ------------------------------------------------ */
type BtnKind = "primary" | "default" | "soft" | "ghost" | "danger" | "dark";
type BtnSize = "sm" | "md" | "lg";

export function Btn({
  children,
  kind = "default",
  size = "md",
  icon,
  full,
  style,
  ...rest
}: {
  children?: ReactNode;
  kind?: BtnKind;
  size?: BtnSize;
  icon?: IconName;
  full?: boolean;
  style?: CSSProperties;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sz = {
    sm: { padding: "7px 12px", fontSize: 13, gap: 6, radius: 9 },
    md: { padding: "10px 16px", fontSize: 14, gap: 8, radius: 11 },
    lg: { padding: "15px 22px", fontSize: 16, gap: 10, radius: 13 },
  }[size];
  const kinds: Record<BtnKind, CSSProperties> = {
    primary: { background: "var(--accent)", color: "#fff", border: "1px solid var(--accent)", boxShadow: "var(--sh-1)" },
    default: { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border-2)" },
    soft: { background: "var(--accent-soft)", color: "var(--accent-ink)", border: "1px solid transparent" },
    ghost: { background: "transparent", color: "var(--ink-2)", border: "1px solid transparent" },
    danger: { background: "var(--red-soft)", color: "var(--red-ink)", border: "1px solid transparent" },
    dark: { background: "var(--ink)", color: "#fff", border: "1px solid var(--ink)" },
  };
  return (
    <button
      className="focusable"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: sz.gap,
        padding: sz.padding,
        fontSize: sz.fontSize,
        fontWeight: 600,
        borderRadius: sz.radius,
        width: full ? "100%" : undefined,
        transition: "transform .08s ease, filter .15s ease, background .15s ease",
        ...kinds[kind],
        ...style,
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(.975)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === "lg" ? 20 : 17} />}
      {children}
    </button>
  );
}

/* ---- Stat card --------------------------------------------- */
export function Stat({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  icon?: IconName;
}) {
  return (
    <div className="card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 600 }}>{label}</span>
        {icon && (
          <span style={{ color: accent || "var(--ink-4)" }}>
            <Icon name={icon} size={18} />
          </span>
        )}
      </div>
      <div className="tnum" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-.02em", color: accent || "var(--ink)" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{sub}</div>}
    </div>
  );
}

/* ---- Panel ------------------------------------------------- */
export function Panel({
  title,
  en,
  right,
  children,
  pad = 18,
  style,
}: {
  title?: ReactNode;
  en?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  pad?: number;
  style?: CSSProperties;
}) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", ...style }}>
      {(title || right) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "15px 18px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
            {en && <span className="en">{en}</span>}
          </div>
          {right}
        </div>
      )}
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}

/* ---- Toggle ------------------------------------------------ */
export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 99,
        border: "none",
        padding: 3,
        background: on ? "var(--accent)" : "var(--border-2)",
        transition: "background .2s",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          display: "block",
          width: 20,
          height: 20,
          borderRadius: 99,
          background: "#fff",
          transform: on ? "translateX(18px)" : "none",
          transition: "transform .2s",
          boxShadow: "0 1px 2px rgba(0,0,0,.2)",
        }}
      />
    </button>
  );
}

/* ---- Modal ------------------------------------------------- */
export function Modal({
  title,
  en,
  onClose,
  children,
  width = 460,
  footer,
}: {
  title?: ReactNode;
  en?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  width?: number;
  footer?: ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div onClick={onClose} className="fade-in" style={{ position: "absolute", inset: 0, background: "rgba(15,27,45,.4)" }} />
      <div
        className="pop-in card"
        style={{
          position: "relative",
          width,
          maxWidth: "100%",
          maxHeight: "90%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--sh-pop)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
            {en && <span className="en">{en}</span>}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "var(--surface-3)", borderRadius: 9, width: 30, height: 30, color: "var(--ink-2)" }}
          >
            <Icon name="x" size={17} />
          </button>
        </div>
        <div className="scroll" style={{ padding: 20, overflowY: "auto" }}>
          {children}
        </div>
        {footer && (
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              padding: "14px 20px",
              borderTop: "1px solid var(--border)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Form field + inputs ----------------------------------- */
export function Field({ label, en, children }: { label: ReactNode; en?: ReactNode; children: ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>{label}</span>
        {en && <span className="en" style={{ fontSize: 11 }}>{en}</span>}
      </div>
      {children}
    </label>
  );
}

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border-2)",
  background: "var(--surface)",
  fontSize: 14,
  color: "var(--ink)",
};

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...props.style }} />;
}

export function SelectInput({ children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} style={{ ...inputStyle, ...p.style }}>
      {children}
    </select>
  );
}

/* ---- Data table -------------------------------------------- */
export type Col = { label: ReactNode; right?: boolean; w?: number };
export function DataTable({ cols, children }: { cols: Col[]; children: ReactNode }) {
  return (
    <div style={{ overflowX: "auto" }} className="scroll">
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {cols.map((c, i) => (
              <th
                key={i}
                style={{
                  textAlign: c.right ? "right" : "left",
                  padding: "0 14px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--ink-3)",
                  whiteSpace: "nowrap",
                  width: c.w,
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/* ---- Search box -------------------------------------------- */
export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 12px",
        height: 38,
        borderRadius: 10,
        border: "1px solid var(--border-2)",
        background: "var(--surface)",
        minWidth: 220,
      }}
    >
      <Icon name="search" size={16} style={{ color: "var(--ink-4)" }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ border: "none", outline: "none", background: "transparent", fontSize: 13.5, flex: 1, color: "var(--ink)" }}
      />
    </div>
  );
}

/* ---- Screen heading ---------------------------------------- */
export function ScreenHead({ th, en, right }: { th: ReactNode; en?: ReactNode; right?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        marginBottom: 18,
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-.02em", whiteSpace: "nowrap" }}>{th}</h1>
        {en && (
          <div className="en" style={{ fontSize: 13, marginTop: 2 }}>
            {en}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

/* ---- Empty state ------------------------------------------- */
export function Empty({ msg = "ไม่มีข้อมูล" }: { msg?: string }) {
  return <div style={{ padding: 28, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>{msg}</div>;
}
