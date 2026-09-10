import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";
import { markAllAlertsReadAction, setAlertReadStateAction } from "@/app/my/actions";
import { MyTrustHubEmpty, MyTrustHubShell, PageHeading } from "@/components/my-trusthub/my-shell";
import { isMyTrustHubFeatureEnabled } from "@/lib/my-trusthub/feature-flags";
import { requireWorkspace } from "@/lib/my-trusthub/page-data";
import type { AlertSeverity } from "@/lib/my-trusthub/alert-contract";

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "Not published by source";
}

export const dynamic = "force-dynamic";

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ filter?: string; severity?: string; error?: string }> }) {
  if (!isMyTrustHubFeatureEnabled("MY_TRUSTHUB_ALERTS_ENABLED")) notFound();
  const { adapter, user } = await requireWorkspace();
  const query = await searchParams;
  const filter = query.filter === "unread" ? "unread" : "all";
  const severity = ["P0", "P1", "P2"].includes(query.severity ?? "") ? query.severity as AlertSeverity : undefined;
  const [alerts, overview] = await Promise.all([
    adapter.listAlerts({ unreadOnly: filter === "unread", severity, limit: 100 }),
    adapter.getAlertsOverview(),
  ]);
  return (
    <MyTrustHubShell active="Alerts" email={user.email ?? "Signed in"}>
      <PageHeading eyebrow="PRIVATE CHANGE HISTORY" title="Alerts">
        Notifications about accepted changes in the public-record fields you explicitly Watch. They are factual records, not recommendations or verdicts.
      </PageHeading>
      {query.error ? <p className="myth-warning" role="alert">That Alert update could not be completed safely. Refresh and try again.</p> : null}
      <section className="myth-alert-toolbar" aria-label="Alert filters">
        <div className="myth-filter-links">
          <Link className={filter === "all" && !severity ? "myth-filter-active" : ""} href="/my/alerts">All ({overview.totalAlerts})</Link>
          <Link className={filter === "unread" && !severity ? "myth-filter-active" : ""} href="/my/alerts?filter=unread">Unread ({overview.unreadAlerts})</Link>
          {(["P0", "P1", "P2"] as AlertSeverity[]).map((level) => <Link key={level} className={severity === level ? "myth-filter-active" : ""} href={`/my/alerts?severity=${level}`}>{level} ({overview.unreadBySeverity[level]})</Link>)}
        </div>
        {overview.unreadAlerts ? <form action={markAllAlertsReadAction}><button className="myth-secondary" type="submit">Mark all read</button></form> : null}
      </section>
      {alerts.length ? (
        <section className="myth-list" aria-label="Alert list">
          {alerts.map((alert) => (
            <article className={`myth-alert-card myth-alert-${alert.severity.toLowerCase()} ${alert.readState === "unread" ? "myth-alert-unread" : ""}`} key={alert.alertRef}>
              <div className="myth-alert-card-main">
                <div className="myth-alert-card-heading"><span className="myth-severity-label">{alert.severity}</span><span className="myth-alert-state">{alert.readState === "unread" ? "Unread" : "Read"}</span></div>
                <h2><Link href={`/my/alerts/${alert.alertRef}`}>{alert.headline}</Link></h2>
                <p>{alert.entityName} · {alert.hub} · {alert.sourceOrganization}</p>
                <dl className="myth-detail-grid"><div><dt>Observed</dt><dd>{dateTime(alert.observedAt)}</dd></div><div><dt>Source as of</dt><dd>{dateTime(alert.officialAsOf)}</dd></div></dl>
                {alert.eventState === "retracted" ? <p className="myth-warning">The source later corrected or retracted this event. The original record remains in history.</p> : null}
              </div>
              <div className="myth-alert-card-actions">
                <Link className="myth-secondary" href={`/my/alerts/${alert.alertRef}`}>View details</Link>
                <form action={setAlertReadStateAction}>
                  <input type="hidden" name="alertRef" value={alert.alertRef} /><input type="hidden" name="rowVersion" value={alert.rowVersion} /><input type="hidden" name="read" value={alert.readState !== "read" ? "true" : "false"} />
                  <button className="myth-text-button" type="submit">{alert.readState === "read" ? "Mark unread" : "Mark read"}</button>
                </form>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <MyTrustHubEmpty title={filter === "unread" ? "No unread Alerts" : "No Alerts yet"}>
          <p><CheckCircle2 aria-hidden="true" /> {filter === "unread" ? "You have reviewed every accepted change currently in your inbox." : "Accepted material changes to your Watch will appear here. Source failures and health delays do not create Alerts."}</p>
        </MyTrustHubEmpty>
      )}
      <p className="myth-disclosure"><Bell aria-hidden="true" size={14} /> Alerts are private consumer history. They never affect public ranking, provider profiles, Watch polling, or source health.</p>
    </MyTrustHubShell>
  );
}
