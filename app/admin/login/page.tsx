"use client";

import { useActionState } from "react";
import { adminSignIn, type AuthState } from "@/app/auth/actions";
import { Btn, Field, TextInput } from "@/components/ui";

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(adminSignIn, {});

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 420, padding: 28 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 15,
              margin: "0 auto 14px",
              background: "var(--ink)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            SC
          </div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>เข้าสู่ระบบผู้ดูแล</h1>
          <div className="en" style={{ fontSize: 13, marginTop: 2 }}>
            Administrator sign in
          </div>
        </div>

        <form action={formAction}>
          <Field label="อีเมล" en="Email">
            <TextInput name="email" type="email" placeholder="admin@screalrail.co.th" autoComplete="email" required />
          </Field>
          <Field label="รหัสผ่าน" en="Password">
            <TextInput name="password" type="password" placeholder="••••••••" autoComplete="current-password" required />
          </Field>

          {state.error && (
            <div
              style={{
                margin: "6px 0 14px",
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--red-soft)",
                color: "var(--red-ink)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {state.error}
            </div>
          )}

          <Btn kind="primary" size="lg" full type="submit" disabled={pending} style={{ marginTop: 4 }}>
            {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </Btn>
        </form>

        <div style={{ textAlign: "center", marginTop: 18 }}>
          <a href="/worker/login" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
            เป็นพนักงาน? เข้าสู่ระบบด้วย PIN →
          </a>
        </div>
      </div>
    </div>
  );
}
