import { LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { cancelWorkspaceDeletionAction, removeWatchNotificationOverrideAction, requestDeletionConfirmationAction, requestExportAction, requestWorkspaceDeletionAction, setWatchNotificationOverrideAction, signOutAction, updateNotificationPreferencesAction } from "@/app/my/actions";
import { ProductionMyTrustHubAdapter } from "@/lib/my-trusthub/production-adapter";
import { notFound } from "next/navigation";
import { MyTrustHubShell, PageHeading } from "@/components/my-trusthub/my-shell";
import { requireWorkspace } from "@/lib/my-trusthub/page-data";

export default async function YouPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireWorkspace();
  const adapter = await ProductionMyTrustHubAdapter.create();
  if (!adapter) notFound();
  const preferences = adapter ? await adapter.getNotificationPreferences() : null;
  const saved = adapter ? await adapter.listSavedEntities() : [];
  const watches = (await Promise.all(saved.filter((row) => !row.removed_at).map(async (row) => ({ saved: row, watch: adapter ? await adapter.getWatch(row.saved_entity_id) : null })))).filter((row) => row.watch);
  const email = user.email ?? "Email unavailable";
  const query = await searchParams;
  const exportRef = typeof query.export === "string" ? query.export : null;
  const deletionRef = typeof query.deletion === "string" ? query.deletion : null;
  const existingDeletion = deletionRef ? await adapter.getWorkspaceDeletionStatus(deletionRef) : null;

  return (
    <MyTrustHubShell active="You" email={email}>
      <PageHeading eyebrow="ACCOUNT / PRIVACY" title="You">
        Your consumer research account and the privacy boundaries that protect it.
      </PageHeading>
      <section className="myth-grid">
        {preferences ? <article className="myth-panel myth-span-three">
          <div className="myth-panel-heading"><h2><ShieldCheck aria-hidden="true" />Notification preferences</h2></div>
          <p className="myth-muted">Urgent alerts arrive immediately. Important updates are grouped into a digest. Lower-priority updates are off by default. These settings never stop a Watch or remove an in-app Alert.</p>
          <form action={updateNotificationPreferencesAction} className="myth-notification-form">
            <input type="hidden" name="rowVersion" value={preferences.rowVersion} />
            <label><input type="checkbox" name="p0EmailEnabled" defaultChecked={preferences.p0EmailEnabled} /> Urgent P0 email alerts</label>
            <label><input type="checkbox" name="p1DigestEnabled" defaultChecked={preferences.p1DigestEnabled} /> Important P1 digest</label>
            <label><input type="checkbox" name="p2DigestEnabled" defaultChecked={preferences.p2DigestEnabled} /> Lower-priority P2 digest</label>
            <label><input type="checkbox" name="periodicWatchSummaryEnabled" defaultChecked={preferences.periodicWatchSummaryEnabled} /> Periodic Watch summary</label>
            <label>Timezone<select name="timezone" defaultValue={preferences.timezone}><option value="UTC">UTC</option><option value="America/New_York">Eastern Time</option><option value="America/Chicago">Central Time</option><option value="America/Denver">Mountain Time</option><option value="America/Los_Angeles">Pacific Time</option></select></label>
            <label>Digest local time<input type="time" name="digestTimeLocal" defaultValue={preferences.digestTimeLocal.slice(0,5)} /></label>
            <button className="myth-primary" type="submit">Save notification preferences</button>
          </form>
          {watches.length ? <div className="myth-watch-notification-list"><h3>Per-Watch email settings</h3>{watches.map(({ saved: entity, watch }) => watch ? <WatchNotificationSettings key={watch.watch_id} watch={watch} entityName={entity.canonical_name} adapter={adapter} /> : null)}</div> : null}
        </article> : null}
        <article className="myth-panel myth-span-two">
          <div className="myth-panel-heading"><h2><UserRound aria-hidden="true" />Account</h2></div>
          <dl className="myth-settings">
            <div><dt>Signed-in email</dt><dd>{email}</dd></div>
            <div><dt>Email confirmed</dt><dd>{user.email_confirmed_at ? "Confirmed" : "Not confirmed"}</dd></div>
            <div><dt>Workspace access</dt><dd>Founder canary</dd></div>
          </dl>
          <form action={signOutAction} className="myth-you-signout">
            <button className="myth-secondary" type="submit">Sign out of My TrustHub</button>
          </form>
        </article>
        <article className="myth-panel">
          <div className="myth-panel-heading"><h2><LockKeyhole aria-hidden="true" />Private by design</h2></div>
          <p>Your Saves, Projects, memberships, and notes are private consumer research.</p>
          <p className="myth-muted">Businesses cannot see your shortlist. Saving does not create a Watch, endorsement, ranking signal, claim, or management grant.</p>
        </article>
        <article className="myth-panel myth-span-three">
          <div className="myth-panel-heading"><h2><ShieldCheck aria-hidden="true" />Your data</h2></div>
          <p>Download a copy of your private My TrustHub research, or request workspace deletion. Public regulatory evidence and Business Manager records are independent and are not removed by consumer deletion.</p>
          <div className="myth-form-row">
            <form action={requestExportAction}><button className="myth-secondary" type="submit">Download my data</button></form>
            {exportRef ? <ExportStatusCard adapter={adapter} exportRef={exportRef} /> : null}
          </div>
          <p className="myth-muted">Exports are private, expire after seven days, and are available only to this account.</p>
          <div className="myth-danger-zone">
            <h3>Delete My TrustHub workspace</h3>
            <p>This starts a seven-day grace period. You can cancel during the grace period. Deletion stops Watches and removes private workspace data while shared public records remain.</p>
            <form action={requestDeletionConfirmationAction}><button className="myth-secondary" type="submit">Start deletion request</button></form>
            {deletionRef && existingDeletion ? <div><p role="status">Deletion status: {existingDeletion.status}. Grace ends {existingDeletion.graceExpiresAt ?? "after the review period"}.</p>{existingDeletion.status === "grace_period" ? <form action={cancelWorkspaceDeletionAction}><input type="hidden" name="deletionRef" value={deletionRef} /><button className="myth-secondary" type="submit">Cancel deletion</button></form> : null}</div> : null}
            {typeof query.delete_code === "string" ? <form action={requestWorkspaceDeletionAction}><label htmlFor="delete-confirmation">Enter the one-time confirmation code</label><input id="delete-confirmation" name="confirmationCode" required maxLength={120} /><button className="myth-danger" type="submit">Confirm workspace deletion</button></form> : null}
          </div>
        </article>
        <article className="myth-panel myth-span-three">
          <div className="myth-panel-heading"><h2><ShieldCheck aria-hidden="true" />Separate from Business Manager</h2></div>
          <p>My TrustHub is your consumer workspace. Business Manager is a separate business-authorized product with separate memberships and management grants.</p>
          <p className="myth-muted">Notification controls affect email delivery only; Watches and in-app Alerts remain separate. Public signup is closed while this product is in its internal canary posture.</p>
        </article>
      </section>
    </MyTrustHubShell>
  );
}

async function ExportStatusCard({ adapter, exportRef }: { adapter: ProductionMyTrustHubAdapter; exportRef: string }) {
  const status = await adapter.getExportStatus(exportRef);
  if (!status) return <span className="myth-muted">Export request not found.</span>;
  return <span className="myth-muted" role="status">Export: {status.status}{status.artifactAvailable ? <> · <a href={`/api/my-trusthub/export/${encodeURIComponent(exportRef)}`}>Download file</a></> : " · preparing securely"}</span>;
}

async function WatchNotificationSettings({ watch, entityName, adapter }: { watch: { watch_id: string; watch_status: string }; entityName: string; adapter: ProductionMyTrustHubAdapter }) {
  const overrides = await adapter.getWatchNotificationOverrides(watch.watch_id);
  return <div className="myth-watch-notification"><strong>{entityName}</strong><span className="myth-muted">{watch.watch_status === "active" ? "Active Watch" : "Watch paused or stopped"}</span><div className="myth-override-grid">{(["P0", "P1", "P2"] as const).map((severity) => { const current = overrides.find((item) => item.severity === severity); return <form key={severity} action={current ? removeWatchNotificationOverrideAction : setWatchNotificationOverrideAction}><input type="hidden" name="watchId" value={watch.watch_id} /><input type="hidden" name="severity" value={severity} />{current ? <button className="myth-secondary" type="submit">{severity}: {current.enabled ? "On" : "Off"} · remove override</button> : <label><input type="checkbox" name="enabled" defaultChecked={severity === "P0"} /> {severity}: override email</label>}</form>; })}</div></div>;
}
