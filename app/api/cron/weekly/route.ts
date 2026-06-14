import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "@/app/api/cron/_auth";
import { sendWeekly } from "@/lib/line/send";

export const dynamic = "force-dynamic";

// Weekly summary (configured Monday 08:00 ICT). Idempotent per ISO week.
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return new NextResponse("Unauthorized", { status: 401 });
  const result = await sendWeekly();
  return NextResponse.json(result);
}
