import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isMyTrustHubFeatureEnabled } from "@/lib/my-trusthub/feature-flags";
import { authorized, safeHeaders } from "@/lib/my-trusthub/p13-runtime";
import { scopedRuntime } from "@/lib/my-trusthub/scoped-runtime";
import { DbprSourceError, fetchDbpr } from "@/lib/my-trusthub/dbpr-adapter";
import { DbprLookupError, fetchDbprLookup, type DbprLookupObservation, type LookupFailure } from "@/lib/my-trusthub/dbpr-lookup";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"), process.env.CRON_SECRET)) return new NextResponse("Unauthorized", { status: 401, headers: safeHeaders });
  if (!isMyTrustHubFeatureEnabled("MY_TRUSTHUB_SOURCE_MONITORING_ENABLED")) return NextResponse.json({ outcome: "disabled" }, { headers: safeHeaders });
  const started = new Date().toISOString();
  try {
    const db = scopedRuntime("dbpr");
    const [v1Targets, v2Targets] = await Promise.all([
      db.query<{ credential: string }>("select credential from ops.dbpr_poll_targets()"),
      db.query<{ credential: string }>("select credential from ops.dbpr_v2_poll_targets()"),
    ]);
    const results: Array<Record<string, unknown>> = [];
    // Existing v1 subscriptions remain on their original bulk contract.
    if (v1Targets.rows.length) {
      let rows: Array<{ credential: string; status: string }> = [], sourceAsOf: string | null = null, failure: string | null = null;
      try { const source = await fetchDbpr(v1Targets.rows.map(row => row.credential)); rows = source.rows; sourceAsOf = source.sourceAsOf; failure = source.failure; }
      catch (error) { failure = error instanceof DbprSourceError ? error.code : "SOURCE_FETCH_FAILED"; }
      const result = await db.query<{ result: Record<string, unknown> }>("select ops.run_dbpr_poll($1,$2,$3,$4,$5::jsonb,$6) as result", [`daily:${randomUUID()}`, started, new Date().toISOString(), sourceAsOf, JSON.stringify(rows), failure]);
      results.push({ version: 1, failure, ...result.rows[0].result });
    }
    if (v2Targets.rows.length) {
      const rows: DbprLookupObservation[] = [];
      let failure: LookupFailure | "SOURCE_CAPACITY_EXCEEDED" | null = null;
      const lookupStarted = new Date().toISOString();
      const deadline = AbortSignal.timeout(60000);
      try {
        if (v2Targets.rows.length > 20) failure = "SOURCE_CAPACITY_EXCEEDED";
        else for (const target of v2Targets.rows) rows.push(await fetchDbprLookup(target.credential, deadline));
      } catch (error) { failure = error instanceof DbprLookupError ? error.code : "SOURCE_FETCH_FAILED"; }
      const result = await db.query<{ result: Record<string, unknown> }>("select ops.run_dbpr_v2_poll($1,$2,$3,$4::jsonb,$5) as result", [`daily:${randomUUID()}`, lookupStarted, new Date().toISOString(), JSON.stringify(failure ? [] : rows), failure]);
      results.push({ version: 2, failure, ...result.rows[0].result });
    }
    const fanout = isMyTrustHubFeatureEnabled("MY_TRUSTHUB_ALERTS_ENABLED")
      ? await fanoutPending(db)
      : { outcome: "disabled", events: 0, alerts: 0, duplicates: 0 };
    const outcome = !results.length ? "no_certified_targets" : results.some(row => row.failure || row.quarantined || row.health !== "current") ? "source_unavailable" : "checked";
    console.info(JSON.stringify({ event: "my_trusthub_dbpr_poll", outcome, results, fanout }));
    return NextResponse.json({ outcome, results, fanout }, { headers: safeHeaders });
  } catch {
    console.error(JSON.stringify({ event: "my_trusthub_dbpr_poll", outcome: "runtime_failed" }));
    return NextResponse.json({ outcome: "runtime_failed" }, { status: 503, headers: safeHeaders });
  }
}

async function fanoutPending(db: ReturnType<typeof scopedRuntime>) {
  const pending = await db.query<{ change_event_id: string }>("select change_event_id from ops.alert_fanout_pending_events($1)", [50]);
  let alerts = 0;
  let duplicates = 0;
  let failures = 0;
  for (const row of pending.rows) {
    try {
      const result = await db.query<{ matching_watches: number; alerts_created: number; duplicates_skipped: number; outcome: string }>(
        "select * from consumer.fanout_change_event($1)", [row.change_event_id],
      );
      const value = result.rows[0];
      alerts += Number(value?.alerts_created ?? 0);
      duplicates += Number(value?.duplicates_skipped ?? 0);
    } catch {
      failures += 1;
    }
  }
  return { outcome: failures ? "retryable_failure" : "complete", events: pending.rows.length, alerts, duplicates, failures };
}
