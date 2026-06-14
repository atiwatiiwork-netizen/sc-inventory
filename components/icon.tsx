import type { CSSProperties } from "react";

/* Inline line-icon set (24×24, stroke) — ported from the prototype. */
const ICON_PATHS = {
  dashboard: "M4 13h7V4H4zM13 20h7v-9h-7zM13 4v5h7V4zM4 20h7v-5H4z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  alert: "M12 4 2.5 20h19zM12 10v5M12 18h.01",
  download: "M12 4v10m0 0 4-4m-4 4-4-4M4 18h16",
  sliders: "M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4",
  box: "M21 8 12 3 3 8l9 5zM3 8v8l9 5 9-5V8M12 13v8",
  layers: "M12 3 2 8l10 5 10-5zM2 14l10 5 10-5",
  users: "M16 18v-2a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v2M9.5 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 18v-2a3 3 0 0 0-2.5-2.95M16.5 3.7a3 3 0 0 1 0 5.8",
  key: "M14.5 6.5a4 4 0 1 1-5.2 5.2L3 18v3h3l.5-.5H8v-1.5h1.5V17l2.3-2.3a4 4 0 0 0 2.7-8.2M17 7h.01",
  chart: "M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-7",
  chat: "M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z",
  logout: "M15 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2M19 12H9m10 0-3-3m3 3-3 3",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "M20 6 9 17l-5-5",
  chevR: "M9 6l6 6-6 6",
  chevD: "M6 9l6 6 6-6",
  chevL: "M15 6l-6 6 6 6",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  calendar: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  x: "M6 6l12 12M18 6 6 18",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  archive: "M3 7h18v3H3zM5 10v10h14V10M9 14h6",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 1 1 8 0v3",
  backspace: "M21 5H8l-5 7 5 7h13a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM17 9l-5 6M12 9l5 6",
  truck: "M3 6h11v9H3zM14 9h4l3 3v3h-7M7 18a2 2 0 1 0 0 .01M18 18a2 2 0 1 0 0 .01",
  store: "M4 9h16l-1-4H5zM5 9v10h14V9M9 19v-5h6v5",
  pin2: "M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11zM12 12a2 2 0 1 0 0-.01",
  bolt: "M13 3 4 14h6l-1 7 9-11h-6z",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 13H4a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4.6V4a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H20a2 2 0 0 1 0 4z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1",
  refresh: "M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5",
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({
  name,
  size = 20,
  stroke = 1.8,
  fill = "none",
  style,
  className,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
  fill?: string;
  style?: CSSProperties;
  className?: string;
}) {
  const d = ICON_PATHS[name] || "";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      aria-hidden="true"
    >
      {d
        .split("M")
        .filter(Boolean)
        .map((seg, i) => (
          <path key={i} d={"M" + seg} />
        ))}
    </svg>
  );
}
