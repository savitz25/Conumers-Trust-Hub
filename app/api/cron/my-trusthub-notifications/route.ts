import { NextResponse } from "next/server";
import { authorized, safeHeaders } from "@/lib/my-trusthub/p13-runtime";
import { isMyTrustHubFeatureEnabled } from "@/lib/my-trusthub/feature-flags";
import { scopedRuntime } from "@/lib/my-trusthub/scoped-runtime";
import { sendMyTrustHubEmail } from "@/lib/my-trusthub/notification-mail";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

type P0Payload = { subject: string; body: string; entity_name: string; watched_grain: string; source: string; observed_at: string; official_as_of: string | null; disclosure: string; manage_notifications_path: string };
type Batch = { user_id: string; recipient: string; delivery_ids: string[]; subject: string; body: string };

export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"), process.env.CRON_SECRET)) return new NextResponse("Unauthorized", { status: 401, headers: safeHeaders });
  if (!isMyTrustHubFeatureEnabled("MY_TRUSTHUB_EMAIL_ENABLED")) return NextResponse.json({ outcome: "disabled", sent: 0 }, { headers: safeHeaders });
  try {
    const db = scopedRuntime("notification");
    const candidates = await db.query<{ alert_id: string; idempotency_key: string }>("select * from ops.pending_alert_delivery_candidates($1)", [100]);
    let enqueued = 0;
    for (const candidate of candidates.rows) {
      const result = await db.query<{ outcome: string }>("select outcome from ops.enqueue_alert_delivery($1,$2)", [candidate.alert_id, candidate.idempotency_key]);
      if (result.rows[0]?.outcome) enqueued += 1;
    }
    const p0 = await db.query<{ delivery_id: string }>("select delivery_id from ops.pending_p0_deliveries($1)", [100]);
    let sent = 0; let failed = 0;
    for (const row of p0.rows) {
      const [payloadResult, recipientResult] = await Promise.all([
        db.query<{ get_p0_email_payload: P0Payload }>("select ops.get_p0_email_payload($1) as get_p0_email_payload", [row.delivery_id]),
        db.query<{ get_email_recipient: string }>("select ops.get_email_recipient($1) as get_email_recipient", [row.delivery_id]),
      ]);
      const payload = payloadResult.rows[0]?.get_p0_email_payload;
      const recipient = recipientResult.rows[0]?.get_email_recipient;
      if (!payload || !recipient) { failed += 1; continue; }
      const official = payload.official_as_of ? `Official/source-as-of: ${payload.official_as_of}` : "Official/source-as-of: not published by the source";
      const mail = await sendMyTrustHubEmail({ to: recipient, subject: payload.subject, text: `${payload.body}\n\nWatched record: ${payload.watched_grain}\nSource: ${payload.source}\n${official}\nObserved/checked-at: ${payload.observed_at}\n\n${payload.disclosure}\nManage notifications: ${process.env.NEXT_PUBLIC_SITE_URL || "https://www.asktrusthub.com"}${payload.manage_notifications_path}` });
      const result = await db.query<{ delivery_status: string; process_outcome: string }>("select delivery_status,process_outcome from ops.process_email_result($1,$2,$3,$4,$5,$6)", [row.delivery_id, mail.outcome, mail.providerMessageRef ?? null, mail.outcome === "success" ? null : mail.outcome.toUpperCase(), `p17:${randomUUID()}`, new Date().toISOString()]);
      if (result.rows[0]?.delivery_status === "delivered") sent += 1; else failed += 1;
    }
    const batches = await db.query<Batch>("select * from ops.get_due_digest_batches($1,$2)", [new Date().toISOString(), 50]);
    let digestBatches = 0;
    for (const batch of batches.rows) {
      const mail = await sendMyTrustHubEmail({ to: batch.recipient, subject: batch.subject, text: `${batch.body}\n\nThis reflects changes in watched public records. It is not a recommendation or verdict.\nManage notifications: ${(process.env.NEXT_PUBLIC_SITE_URL || "https://www.asktrusthub.com")}/my/you` });
      for (const deliveryId of batch.delivery_ids) await db.query("select ops.process_email_result($1,$2,$3,$4,$5,$6)", [deliveryId, mail.outcome, mail.providerMessageRef ?? null, mail.outcome === "success" ? null : mail.outcome.toUpperCase(), `p17:digest:${randomUUID()}`, new Date().toISOString()]);
      digestBatches += 1;
    }
    const outcome = failed ? "completed_with_failures" : "complete";
    console.info(JSON.stringify({ event: "my_trusthub_notification_delivery", outcome, enqueued, p0: p0.rows.length, sent, failed, digest_batches: digestBatches }));
    return NextResponse.json({ outcome, enqueued, sent, failed, digestBatches }, { headers: safeHeaders });
  } catch {
    console.error(JSON.stringify({ event: "my_trusthub_notification_delivery", outcome: "runtime_failed" }));
    return NextResponse.json({ outcome: "runtime_failed" }, { status: 503, headers: safeHeaders });
  }
}
