import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "@/app/api/cron/_auth";
import { sendMonthly } from "@/lib/line/send";

export const dynamic = "force-dynamic";

// Monthly summary (configured 1st of month 08:00 ICT). Idempotent per month.
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return new NextResponse("Unauthorized", { status: 401 });
  const result = await sendMonthly();
  return NextResponse.json(result);
}
