import Link from "next/link";
import { notFound } from "next/navigation";
import { setAlertReadStateAction } from "@/app/my/actions";
import { MyTrustHubShell, PageHeading } from "@/components/my-trusthub/my-shell";
import { isMyTrustHubFeatureEnabled } from "@/lib/my-trusthub/feature-flags";
import { requireWorkspace } from "@/lib/my-trusthub/page-data";

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "Not published by source";
}

function valueEntries(value: Record<string, unknown> | null) {
  return value ? Object.entries(value).filter(([key]) => key !== "official_status") : [];
}

export const dynamic = "force-dynamic";

export default async function AlertDetailPage({ params }: { params: Promise<{ alertId: string }> }) {
  if (!isMyTrustHubFeatureEnabled("MY_TRUSTHUB_ALERTS_ENABLED")) notFound();
  const { adapter, user } = await requireWorkspace();
  const { alertId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(alertId)) notFound();
  const alert = await adapter.getAlertDetail(alertId);
  if (!alert) notFound();
  return (
    <MyTrustHubShell active="Alerts" email={user.email ?? "Signed in"}>
      <PageHeading eyebrow="ALERT DETAIL" title={alert.headline}>
        A traceable change in the public-record field you asked My TrustHub to Watch.
      </PageHeading>
      {alert.correctionNotice ? <p className="myth-warning" role="status">{alert.correctionNotice}</p> : null}
      <article className="myth-panel myth-alert-detail">
        <div className="myth-alert-card-heading"><span className="myth-severity-label">{alert.severity}</span><span>{alert.readState === "unread" ? "Unread" : "Read"}</span></div>
        <h2>{alert.entityName}</h2>
        <p className="myth-muted">{alert.hub} · {alert.coverageDisplayName} · version {alert.capabilityVersion}</p>
        <p>{alert.detailBody}</p>
        <div className="myth-change-values">
          <section><h3>Previous value</h3>{valueEntries(alert.previousValue).length ? <dl>{valueEntries(alert.previousValue).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{String(value)}</dd></div>)}</dl> : <p className="myth-muted">No previous value was published for this baseline.</p>}</section>
          <section><h3>Current value</h3>{valueEntries(alert.currentValue).length ? <dl>{valueEntries(alert.currentValue).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{String(value)}</dd></div>)}</dl> : <p className="myth-muted">Current value unavailable.</p>}</section>
        </div>
        <dl className="myth-detail-grid">
          <div><dt>Source</dt><dd>{alert.sourceOrganization}</dd></div><div><dt>Watched grain</dt><dd>{alert.watchedGrain}</dd></div>
          <div><dt>Official source as of</dt><dd>{dateTime(alert.officialAsOf)}</dd></div><div><dt>Checked at</dt><dd>{dateTime(alert.checkedAt)}</dd></div>
          <div><dt>Observed at</dt><dd>{dateTime(alert.observedAt)}</dd></div><div><dt>Coverage version</dt><dd>{alert.capabilityVersion}</dd></div>
        </dl>
        {alert.sourceConfirmationRef ? <p><a className="myth-text-link" href={alert.sourceConfirmationRef} target="_blank" rel="noopener noreferrer">View the authoritative source</a></p> : null}
        <p className="myth-disclosure">{alert.disclosure} {alert.whyReceived}</p>
        <div className="myth-actions">
          <form action={setAlertReadStateAction}><input type="hidden" name="alertRef" value={alert.alertRef} /><input type="hidden" name="rowVersion" value={alert.rowVersion} /><input type="hidden" name="read" value={alert.readState !== "read" ? "true" : "false"} /><button className="myth-primary" type="submit">{alert.readState === "read" ? "Mark unread" : "Mark read"}</button></form>
          <Link className="myth-secondary" href="/my/alerts">Back to Alerts</Link>
        </div>
      </article>
      <p className="myth-disclosure">This reflects a change in the watched public record. It is not a recommendation or verdict.</p>
    </MyTrustHubShell>
  );
}
