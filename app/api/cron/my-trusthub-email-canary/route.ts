import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authorized, safeHeaders } from "@/lib/my-trusthub/p13-runtime";
import { isMyTrustHubFeatureEnabled } from "@/lib/my-trusthub/feature-flags";
import { scopedRuntime } from "@/lib/my-trusthub/scoped-runtime";
import { sendMyTrustHubEmail } from "@/lib/my-trusthub/notification-mail";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"), process.env.CRON_SECRET)) return new NextResponse("Unauthorized", { status: 401, headers: safeHeaders });
  if (!isMyTrustHubFeatureEnabled("MY_TRUSTHUB_EMAIL_ENABLED") || process.env.MY_TRUSTHUB_CANARY_ONLY?.toLowerCase() !== "true") return NextResponse.json({ outcome: "disabled" }, { headers: safeHeaders });
  const recipient = "hello@asktrusthub.com";
  const mail = await sendMyTrustHubEmail({ to: recipient, subject: "My TrustHub internal notification delivery test", text: "My TrustHub internal notification delivery test. This message is a transport canary and does not describe a real public-record change." });
  const db = scopedRuntime("notification");
  const recorded = await db.query<{ record_transport_canary: string }>("select ops.record_transport_canary($1,$2,$3,$4) as record_transport_canary", [createHash("sha256").update(recipient.toLowerCase()).digest("hex"), mail.outcome === "success" ? "accepted" : "failed", mail.providerMessageRef ?? null, mail.outcome === "success" ? null : mail.outcome]);
  return NextResponse.json({ outcome: mail.outcome, canary_id: recorded.rows[0]?.record_transport_canary ?? null }, { headers: safeHeaders });
}
