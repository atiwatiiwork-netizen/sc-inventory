import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { WORKER_COOKIE, WORKER_SESSION_SECONDS } from "@/lib/auth-constants";
import type { WorkerSession } from "@/lib/types";

const secret = () => process.env.WORKER_SESSION_SECRET || "dev-insecure-secret";

type Payload = WorkerSession & { exp: number };

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

/** Create a tamper-proof token for a worker session. */
export function encodeWorkerSession(session: WorkerSession): string {
  const payload: Payload = { ...session, exp: Date.now() + WORKER_SESSION_SECONDS * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string): WorkerSession | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return { id: payload.id, code: payload.code, name: payload.name };
  } catch {
    return null;
  }
}

/** Read and verify the current worker session from cookies. */
export async function getWorkerSession(): Promise<WorkerSession | null> {
  const store = await cookies();
  const token = store.get(WORKER_COOKIE)?.value;
  return token ? decode(token) : null;
}
