"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { workerVerifyPin } from "@/app/auth/actions";
import { Icon } from "@/components/icon";

export default function WorkerLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (value: string) => {
    startTransition(async () => {
      const res = await workerVerifyPin(value);
      if (res.error) {
        setErr(res.error);
        setPin("");
      } else {
        router.replace("/worker");
      }
    });
  };

  const press = (k: string) => {
    if (pending) return;
    setErr(null);
    if (k === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) submit(next);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", background: "var(--surface-2)" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          padding: "28px 26px 32px",
          background: "var(--surface)",
        }}
      >
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 17,
              margin: "0 auto 16px",
              background: "var(--ink)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: "-.02em",
            }}
          >
            SC
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>บันทึกการใช้ประจำวัน</div>
          <div className="en" style={{ fontSize: 13, marginTop: 2 }}>
            Daily Usage · enter your PIN
          </div>
        </div>

        {/* pin dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 14, margin: "34px 0 8px" }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: 17,
                height: 17,
                borderRadius: 99,
                background: err ? "var(--red)" : i < pin.length ? "var(--accent)" : "transparent",
                border: `2px solid ${err ? "var(--red)" : i < pin.length ? "var(--accent)" : "var(--border-2)"}`,
                transition: "all .15s",
              }}
            />
          ))}
        </div>
        <div style={{ height: 18, textAlign: "center", color: "var(--red)", fontSize: 13, fontWeight: 600 }}>
          {err || ""}
        </div>

        {/* keypad */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: "auto" }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) =>
            k === "" ? (
              <div key={i} />
            ) : (
              <button
                key={i}
                onClick={() => press(k)}
                disabled={pending}
                className="focusable"
                style={{
                  height: 66,
                  borderRadius: 18,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  fontSize: 27,
                  fontWeight: 600,
                  color: "var(--ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {k === "del" ? <Icon name="backspace" size={26} /> : k}
              </button>
            ),
          )}
        </div>

        <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink-4)", marginTop: 16 }}>
          ทดลอง: 1111 · 2222 · 3333 · 4444
        </div>
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <a href="/admin/login" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
            เป็นผู้ดูแล? เข้าสู่ระบบด้วยอีเมล →
          </a>
        </div>
      </div>
    </div>
  );
}
