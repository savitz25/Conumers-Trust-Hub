import { randomUUID } from "node:crypto";
import { Radar } from "lucide-react";
import { notFound } from "next/navigation";
import {
  pauseWatchAction,
  restartWatchAction,
  resumeWatchAction,
  startWatchAction,
  stopWatchAction,
} from "@/app/my/actions";
import { MyTrustHubEmpty, MyTrustHubShell, PageHeading } from "@/components/my-trusthub/my-shell";
import { isMyTrustHubFeatureEnabled } from "@/lib/my-trusthub/feature-flags";
import { requireWorkspace } from "@/lib/my-trusthub/page-data";

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "Unavailable";
}

export const dynamic = "force-dynamic";

export default async function WatchesPage({ searchParams }: { searchParams: Promise<{ started?: string; error?: string }> }) {
  if (!isMyTrustHubFeatureEnabled("MY_TRUSTHUB_WATCH_ENABLED")) notFound();
  const { adapter, user } = await requireWorkspace();
  const [query, saved] = await Promise.all([searchParams, adapter.listSavedEntities()]);
  const items = await Promise.all(saved.filter((item) => !item.removed_at).map(async (item) => {
    const [capabilities, watch] = await Promise.all([
      adapter.listAvailableWatchCapabilities(item.saved_entity_id),
      adapter.getWatch(item.saved_entity_id),
    ]);
    const [coverage, health, checks] = watch
      ? await Promise.all([adapter.getWatchCoverage(watch.watch_id), adapter.getWatchSourceHealth(item.saved_entity_id), adapter.getWatchCheckDetails(item.saved_entity_id)])
      : [[], [], []];
    return { item, capabilities, watch, coverage, health, checks };
  }));
  const watchable = items.filter(({ capabilities, watch }) => watch || capabilities.some((capability) => capability.eligible));

  return (
    <MyTrustHubShell active="Watches" email={user.email ?? "Signed in"}>
      <PageHeading eyebrow="EXPLICIT MONITORING" title="Watches">
        Choose the exact public-record fields you want re-checked. Saving research never starts a Watch.
      </PageHeading>
      {query.started ? <p className="myth-notice" role="status">Watch started with the coverage you selected.</p> : null}
      {query.error ? <p className="myth-warning" role="alert">That Watch change could not be completed safely. Refresh and try again.</p> : null}
      <section className="myth-list" aria-label="Your Watches">
        {watchable.length ? watchable.map(({ item, capabilities, watch, coverage, health, checks }) => {
          const eligible = capabilities.filter((capability) => capability.eligible);
          const overallHealth = health.some((row) => row.health_status === "unknown") ? "unknown"
            : health.some((row) => row.health_status === "degraded") ? "degraded"
              : health.some((row) => row.health_status === "delayed") ? "delayed" : health.length ? "current" : "unknown";
          return (
            <article className="myth-row-card" key={item.saved_entity_id}>
              <div className="myth-panel-heading">
                <h2><Radar aria-hidden="true" size={20} />{item.canonical_name}</h2>
                {watch ? <span className={`myth-status myth-status-${watch.watch_status}`}>{watch.watch_status}</span> : null}
              </div>
              <p className="myth-muted">{item.primary_hub} · exact saved profile binding</p>
              {checks.map((check) => <div key={check.capability_id}>
                <p><strong>{check.source_identifier}</strong> · {check.identifier_namespace}</p>
                <dl className="myth-detail-grid"><div><dt>Checked at</dt><dd>{dateTime(check.checked_at)}</dd></div><div><dt>Last successful check</dt><dd>{dateTime(check.last_successful_check)}</dd></div></dl>
                {check.error_code ? <p className="myth-warning" role="status">The latest official source check could not confirm compatible status for this exact license. No-change assurance is unavailable. Missing from an extract does not establish a license status.</p> : null}
              </div>)}
              {!watch ? (
                <form action={startWatchAction} className="myth-watch-start">
                  <input type="hidden" name="savedEntityId" value={item.saved_entity_id} />
                  <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                  <fieldset>
                    <legend>Confirm exact Watch coverage</legend>
                    {eligible.map((capability) => (
                      <label key={capability.capability_id}>
                        <input type="checkbox" name="capabilityId" value={capability.capability_id} />
                        <span><strong>{capability.display_name}</strong><small>{capability.consumer_description}</small></span>
                      </label>
                    ))}
                  </fieldset>
                  <button className="myth-primary" type="submit">Start selected Watch</button>
                  <p className="myth-muted">Nothing is watched until you confirm this form.</p>
                </form>
              ) : (
                <>
                  <h3>Exact coverage</h3>
                  <ul className="myth-coverage-list">
                    {coverage.map((row) => (
                      <li key={row.coverage_id}>
                        <div><strong>{row.display_name}</strong><small>{row.source_key} · version {row.capability_version} · {row.grain_key}</small></div>
                        <span>{row.coverage_status}</span>
                        {row.coverage_limitations.length ? <div className="myth-limitations"><strong>Not currently watched</strong><ul>{row.coverage_limitations.map((limit) => <li key={limit}>{limit}</li>)}</ul></div> : null}
                      </li>
                    ))}
                  </ul>
                  <div className="myth-checks">
                    <p><strong>Source health</strong><span className={`myth-health myth-health-${overallHealth}`}>{overallHealth}</span><small>Unknown or degraded never means “no change.”</small></p>
                    {health.map((row) => <div className="myth-source-clock" key={row.coverage_id}>
                      <h3>{row.source_key}</h3>
                      <dl className="myth-detail-grid">
                        <div><dt>Source as of</dt><dd>{dateTime(row.source_as_of)}</dd></div>
                        <div><dt>Completeness</dt><dd>{row.completeness_status}</dd></div>
                        <div><dt>Schema</dt><dd>{row.schema_status}</dd></div>
                      </dl>
                      <p className="myth-muted">{row.no_change_eligible ? "No material change detected in the latest complete, compatible check." : "No-change assurance is unavailable for this check."}</p>
                    </div>)}
                  </div>
                  <form action={watch.watch_status === "active" ? pauseWatchAction : watch.watch_status === "paused" ? resumeWatchAction : restartWatchAction} className="myth-actions">
                    <input type="hidden" name="watchId" value={watch.watch_id} />
                    <input type="hidden" name="rowVersion" value={watch.row_version} />
                    {watch.watch_status === "stopped" ? eligible.map((capability) => <input key={capability.capability_id} type="hidden" name="capabilityId" value={capability.capability_id} />) : null}
                    <button className="myth-secondary" type="submit">{watch.watch_status === "active" ? "Pause Watch" : watch.watch_status === "paused" ? "Resume Watch" : "Restart Watch"}</button>
                    {watch.watch_status !== "stopped" ? <button className="myth-text-danger" formAction={stopWatchAction} type="submit">Stop Watch</button> : null}
                  </form>
                </>
              )}
            </article>
          );
        }) : <MyTrustHubEmpty title="No Watchable records yet"><p>Save an exact profile with certified public-record coverage. Unsupported records remain Saved without implying monitoring.</p></MyTrustHubEmpty>}
      </section>
    </MyTrustHubShell>
  );
}
