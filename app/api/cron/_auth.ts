import { type NextRequest } from "next/server";

/**
 * Vercel Cron automatically sends `Authorization: Bearer <CRON_SECRET>` when the
 * CRON_SECRET env var is set. We reject anything else so the endpoints can't be
 * triggered by the public.
 */
export function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
