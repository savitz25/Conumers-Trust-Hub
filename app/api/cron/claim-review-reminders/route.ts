import { NextResponse } from "next/server";
import { authorized, safeHeaders } from "@/lib/my-trusthub/p13-runtime";
import { withPlatform } from "@/lib/customer/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ATH-CLAIM-V2-001 Section 8 — bounded internal staff reminder for open claims over the 2-business-day review
 * target (Q6 relabel; previously and inaccurately called "48 business hours"). CRON_SECRET-guarded. Uses
 * existing notification tables + mailer only; at most one reminder per claim per UTC day; never contacts a
 * claimant; never fires for a claim WAITING_ON_CLAIMANT (Q5). `?dry=1` reports candidates without writing.
 *
 * ATH-CLAIM-V2-001R2 (Q4) — IMPLEMENTED_NOT_SCHEDULED. This route is correct and safe to call, but nothing
 * calls it yet: there is no entry for it in vercel.json's `crons`. Adding a live schedule is a Founder decision
 * (it starts sending real staff reminders in Production on whatever cadence is chosen), so this ticket leaves
 * it registered as available-but-dormant rather than picking a schedule unilaterally.
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
