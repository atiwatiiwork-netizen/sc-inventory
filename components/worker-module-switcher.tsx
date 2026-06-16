"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";

const MODS: { id: string; th: string; icon: IconName; href: string; match: (p: string) => boolean }[] = [
  { id: "inventory", th: "สต็อกคลัง", icon: "grid", href: "/worker", match: (p) => !p.startsWith("/worker/wheels") },
  { id: "wheels", th: "SC Wheels", icon: "settings", href: "/worker/wheels", match: (p) => p.startsWith("/worker/wheels") },
];

/** Slim module switcher shown at the top of the worker area (after PIN login). */
export function WorkerModuleSwitcher() {
  const pathname = usePathname();
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        padding: "8px 12px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      {MODS.map((m) => {
        const on = m.match(pathname);
        return (
          <Link
            key={m.id}
            href={m.href}
            className="focusable"
            style={{
              flex: 1,
              maxWidth: 220,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 6px",
              borderRadius: 9,
              textDecoration: "none",
              fontSize: 12.5,
              fontWeight: 600,
              background: on ? "var(--accent-soft)" : "var(--surface-3)",
              color: on ? "var(--accent-ink)" : "var(--ink-3)",
            }}
          >
            <Icon name={m.icon} size={15} style={{ color: on ? "var(--accent)" : "var(--ink-4)" }} />
            {m.th}
          </Link>
        );
      })}
    </div>
  );
}
