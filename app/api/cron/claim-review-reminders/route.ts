import { NextResponse } from "next/server";
import { authorized, safeHeaders } from "@/lib/my-trusthub/p13-runtime";
import { withPlatform } from "@/lib/customer/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ATH-CLAIM-V2-001 Section 8 — bounded internal staff reminder for open claims over the 48 business-hour
 * target. CRON_SECRET-guarded. Uses existing notification tables + mailer only; at most one reminder per claim
 * per UTC day; never contacts a claimant. `?dry=1` reports candidates without writing.
 */
export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"), process.env.CRON_SECRET)) return new NextResponse("Unauthorized", { status: 401, headers: safeHeaders });
  const dryRun = new URL(request.url).searchParams.get("dry") === "1";
  try {
    const result = await withPlatform((p) => p.reviewQueueReminders({ dryRun, limit: 20 }));
    return NextResponse.json({ ok: true, dryRun, ...result }, { headers: safeHeaders });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500, headers: safeHeaders });
  }
}
