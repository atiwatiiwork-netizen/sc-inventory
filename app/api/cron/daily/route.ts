import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "@/app/api/cron/_auth";
import { sendDaily } from "@/lib/line/send";

export const dynamic = "force-dynamic";

// Fallback daily send (configured 19:30 ICT). Idempotent — if the after-submit
// trigger already sent today's summary, this is a no-op.
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return new NextResponse("Unauthorized", { status: 401 });
  const result = await sendDaily();
  return NextResponse.json(result);
}
