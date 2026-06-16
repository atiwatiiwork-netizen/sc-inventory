"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { MODULES, moduleForPath } from "@/lib/nav";
import { Icon } from "@/components/icon";
import { adminSignOut } from "@/app/auth/actions";

export function AdminShell({ profileName, isAdmin = true, children }: { profileName: string; isAdmin?: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const mod = moduleForPath(pathname);
  // hide admin-only items (e.g. exceptional raw-wheel sale) from office users
  const nav = mod.nav
    .map((g) => ({ ...g, items: g.items.filter((it) => isAdmin || !it.adminOnly) }))
    .filter((g) => g.items.length > 0);
  const items = nav.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group })));
  // longest matching href wins so /admin/products beats /admin
  const active = items
    .filter((it) => pathname === it.href || (it.href !== "/admin" && pathname.startsWith(it.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];

  const [pending, start] = useTransition();
  const initial = profileName.trim().charAt(0) || "อ";

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", background: "var(--bg)" }}>
      {/* sidebar */}
      <aside
        style={{
          width: 232,
          flex: "none",
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "var(--ink)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 15,
              flex: "none",
            }}
          >
            SC
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1 }}>{mod.th}</div>
            <div className="en" style={{ fontSize: 10.5 }}>
              Admin Console
            </div>
          </div>
        </div>

        {/* module switcher */}
        <div style={{ display: "flex", gap: 6, padding: "12px 12px 0" }}>
          {MODULES.map((m) => {
            const on = m.id === mod.id;
            return (
              <Link
                key={m.id}
                href={m.home}
                className="focusable"
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "8px 6px",
                  borderRadius: 9,
                  textDecoration: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  background: on ? "var(--accent-soft)" : "var(--surface-3)",
                  color: on ? "var(--accent-ink)" : "var(--ink-3)",
                  border: on ? "1px solid var(--accent-soft-2)" : "1px solid transparent",
                }}
              >
                <Icon name={m.icon} size={15} style={{ color: on ? "var(--accent)" : "var(--ink-4)", flex: "none" }} />
                {m.th}
              </Link>
            );
          })}
        </div>

        <nav className="scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 12px 18px" }}>
          {nav.map((grp) => (
            <div key={grp.group} style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: "var(--ink-4)",
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                  padding: "0 10px 6px",
                }}
              >
                {grp.group}
              </div>
              {grp.items.map((it) => {
                const on = active?.id === it.id;
                return (
                  <Link
                    key={it.id}
                    href={it.href}
                    className="focusable"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 11,
                      padding: "9px 10px",
                      borderRadius: 10,
                      marginBottom: 2,
                      textDecoration: "none",
                      background: on ? "var(--accent-soft)" : "transparent",
                      color: on ? "var(--accent-ink)" : "var(--ink-2)",
                      fontWeight: on ? 600 : 500,
                    }}
                  >
                    <Icon name={it.icon} size={18} style={{ color: on ? "var(--accent)" : "var(--ink-4)", flex: "none" }} />
                    <span style={{ fontSize: 13.5 }}>{it.th}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 99,
                background: "var(--accent-soft-2)",
                color: "var(--accent-ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 13,
                flex: "none",
              }}
            >
              {initial}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {profileName}
              </div>
              <div className="en" style={{ fontSize: 10.5 }}>
                Administrator
              </div>
            </div>
            <button
              title="ออกจากระบบ"
              onClick={() => start(() => adminSignOut())}
              disabled={pending}
              style={{ border: "none", background: "transparent", color: "var(--ink-4)" }}
            >
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%" }}>
        <header
          style={{
            height: 56,
            flex: "none",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 22px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--ink-3)" }}>
            <span>{active?.group}</span>
            <Icon name="chevR" size={14} />
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>{active?.th}</span>
          </div>
        </header>
        <main key={pathname} className="scroll fade-up" style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
