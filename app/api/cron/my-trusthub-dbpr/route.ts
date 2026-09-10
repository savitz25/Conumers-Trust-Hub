import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isMyTrustHubFeatureEnabled } from "@/lib/my-trusthub/feature-flags";
import { authorized, safeHeaders } from "@/lib/my-trusthub/p13-runtime";
import { scopedRuntime } from "@/lib/my-trusthub/scoped-runtime";
import { DbprSourceError, fetchDbpr } from "@/lib/my-trusthub/dbpr-adapter";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"), process.env.CRON_SECRET)) return new NextResponse("Unauthorized", { status: 401, headers: safeHeaders });
  if (!isMyTrustHubFeatureEnabled("MY_TRUSTHUB_SOURCE_MONITORING_ENABLED")) return NextResponse.json({ outcome: "disabled" }, { headers: safeHeaders });
  const started = new Date().toISOString();
  try {
    const db = scopedRuntime("dbpr");
    const targets = await db.query<{ credential: string }>("select credential from ops.dbpr_poll_targets()");
    if (!targets.rows.length) return NextResponse.json({ outcome: "no_certified_targets" }, { headers: safeHeaders });
    let rows: Array<{ credential: string; status: string }> = [], sourceAsOf: string | null = null, failure: string | null = null;
    try { const source = await fetchDbpr(targets.rows.map((row) => row.credential)); rows = source.rows; sourceAsOf = source.sourceAsOf; failure = source.failure; }
    catch (error) { failure = error instanceof DbprSourceError ? error.code : "SOURCE_FETCH_FAILED"; }
    const retrieved = new Date().toISOString();
    const result = await db.query<{ result: Record<string, unknown> }>("select ops.run_dbpr_poll($1,$2,$3,$4,$5::jsonb,$6) as result", [`daily:${randomUUID()}`, started, retrieved, sourceAsOf, JSON.stringify(rows), failure]);
    const outcome = failure ? "source_unavailable" : "checked";
    console.info(JSON.stringify({ event: "my_trusthub_dbpr_poll", outcome, failure, ...result.rows[0].result }));
    return NextResponse.json({ outcome, failure, ...result.rows[0].result }, { headers: safeHeaders });
  } catch {
    console.error(JSON.stringify({ event: "my_trusthub_dbpr_poll", outcome: "runtime_failed" }));
    return NextResponse.json({ outcome: "runtime_failed" }, { status: 503, headers: safeHeaders });
  }
}
