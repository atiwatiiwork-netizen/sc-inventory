"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { encodeWorkerSession } from "@/lib/worker-session";
import { WORKER_COOKIE, WORKER_SESSION_SECONDS } from "@/lib/auth-constants";
import type { WorkerSession } from "@/lib/types";

export type AuthState = { error?: string };

function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/* ---- Admin: email + password (Supabase Auth) -------------- */
export async function adminSignIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!supabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ดูไฟล์ README" };
  }
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };

  redirect("/admin");
}

export async function adminSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

/* ---- Worker: 4-digit PIN ----------------------------------- */
export async function workerVerifyPin(pin: string): Promise<AuthState> {
  if (!/^\d{4}$/.test(pin)) return { error: "PIN ต้องเป็นตัวเลข 4 หลัก" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !supabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ดูไฟล์ README" };
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("worker_login", { p_pin: pin });
  const row = (data as WorkerSession[] | null)?.[0];
  if (error || !row) return { error: "PIN ไม่ถูกต้อง ลองอีกครั้ง" };

  const token = encodeWorkerSession({ id: row.id, code: row.code, name: row.name });
  const store = await cookies();
  store.set(WORKER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WORKER_SESSION_SECONDS,
  });
  return {};
}

export async function workerSignOut() {
  const store = await cookies();
  store.delete(WORKER_COOKIE);
  redirect("/worker/login");
}
