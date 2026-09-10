import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { scopedRuntime } from "@/lib/my-trusthub/scoped-runtime";
import { authorized, safeHeaders } from "@/lib/my-trusthub/p13-runtime";
import { isMyTrustHubFeatureEnabled } from "@/lib/my-trusthub/feature-flags";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"), process.env.CRON_SECRET)) return new NextResponse("Unauthorized", { status: 401, headers: safeHeaders });
  const result = { export: "disabled", deletion: "disabled" };
  try {
    if (isMyTrustHubFeatureEnabled("MY_TRUSTHUB_EXPORT_ENABLED")) {
      const db = scopedRuntime("export");
      const jobs = await db.query<{ id: string }>("select id from ops.consumer_export_jobs where status='queued' order by requested_at limit 10");
      for (const job of jobs.rows) {
        const lease = randomUUID();
        const claimed = await db.query<{ claim_consumer_export_job: boolean }>("select ops.claim_consumer_export_job($1,$2,$3) as claim_consumer_export_job", [job.id, "vercel-lifecycle", lease]);
        if (!claimed.rows[0]?.claim_consumer_export_job) continue;
        try { await db.query("select ops.complete_consumer_export_job_with_bundle($1,$2,$3)", [job.id, lease, `exports/${job.id}`]); }
        catch { await db.query("select ops.fail_consumer_export_job($1,$2,$3)", [job.id, lease, "EXPORT_BUILD_FAILED"]).catch(() => undefined); }
      }
      result.export = `processed:${jobs.rows.length}`;
    }
    if (isMyTrustHubFeatureEnabled("MY_TRUSTHUB_DELETE_ENABLED")) {
      const db = scopedRuntime("deletion");
      const jobs = await db.query<{ id: string }>("select id from ops.consumer_deletion_jobs where (status='grace_period' and grace_expires_at<=statement_timestamp()) or status='failed' order by requested_at limit 5");
      for (const job of jobs.rows) {
        const lease = randomUUID();
        const claimed = await db.query<{ claim_consumer_deletion_job: boolean }>("select ops.claim_consumer_deletion_job($1,$2,$3) as claim_consumer_deletion_job", [job.id, "vercel-lifecycle", lease]);
        if (!claimed.rows[0]?.claim_consumer_deletion_job) continue;
        const steps = ["suppress_delivery_handoffs", "delete_notifications_alerts", "delete_decisions_snapshots", "delete_sessions_notes_projects", "delete_watches_saves", "delete_profile_identity_links"];
        try { for (const step of steps) await db.query("select ops.run_consumer_deletion_step($1,$2,$3)", [job.id, lease, step]); await db.query("select ops.complete_consumer_deletion_job($1,$2)", [job.id, lease]); }
        catch { /* checkpointed job remains retryable */ }
      }
      result.deletion = `processed:${jobs.rows.length}`;
    }
    return NextResponse.json({ ok: true, ...result }, { headers: safeHeaders });
  } catch (error) {
    console.error(JSON.stringify({ event: "my_trusthub_lifecycle", outcome: "runtime_failed", code: error instanceof Error ? error.name : "unknown", message: error instanceof Error ? error.message.slice(0, 160) : "unknown" }));
    return NextResponse.json({ ok: false, ...result }, { status: 503, headers: safeHeaders });
  }
}
