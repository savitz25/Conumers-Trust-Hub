import { Bookmark, LockKeyhole } from "lucide-react";
import { saveCanaryEntityAction } from "@/app/my/actions";
import {
  MyTrustHubEmpty,
  MyTrustHubShell,
  PageHeading,
} from "@/components/my-trusthub/my-shell";
import { isMyTrustHubFeatureEnabled } from "@/lib/my-trusthub/feature-flags";
import { requireWorkspace } from "@/lib/my-trusthub/page-data";

export default async function SavedPage() {
  const { adapter, user } = await requireWorkspace();
  const saved = await adapter.listSavedEntities();
  const active = saved.filter((item) => !item.removed_at);
  const canSave = isMyTrustHubFeatureEnabled("MY_TRUSTHUB_SAVED_ENABLED");

  return (
    <MyTrustHubShell active="Saved" email={user.email ?? "Signed in"}>
      <PageHeading eyebrow="PRIVATE RESEARCH LIBRARY" title="Saved Research">
        Saved profiles stay available whether or not they belong to a Project.
      </PageHeading>
      {canSave ? (
        <details className="myth-create">
          <summary>Save controlled canary entity</summary>
          <form action={saveCanaryEntityAction} className="myth-form myth-form-grid">
            <label htmlFor="binding-id">Approved binding UUID</label>
            <input
              id="binding-id"
              name="bindingId"
              inputMode="text"
              autoComplete="off"
              required
              maxLength={36}
              pattern="[0-9a-fA-F-]{36}"
            />
            <button className="myth-primary" type="submit">Save entity</button>
          </form>
          <p className="myth-muted">
            Internal canary only. Use the binding created through the approved
            parent identity-governance path.
          </p>
        </details>
      ) : (
        <p className="myth-warning">Save mutations are disabled by the launch gate.</p>
      )}
      <section className="myth-grid">
        <article className="myth-panel myth-span-two">
          <div className="myth-panel-heading">
            <h2>Saved profiles</h2>
            <span>{active.length}</span>
          </div>
          {active.length ? active.map((item) => (
            <div className="myth-saved-block" key={item.saved_entity_id}>
              <div className="myth-row">
                <Bookmark aria-hidden="true" />
                <span>
                  <strong>{item.canonical_name}</strong>
                  <small>
                    {item.primary_hub} ·{" "}
                    {item.project_ids.length
                      ? `${item.project_ids.length} Projects`
                      : "Unfiled"}
                  </small>
                  {item.identity_resolution_state === "review_required" ? (
                    <em>Identity review required</em>
                  ) : null}
                </span>
              </div>
            </div>
          )) : (
            <MyTrustHubEmpty title="Nothing Saved yet">
              <p>
                Save the controlled canary entity. Saving never starts a Watch.
              </p>
            </MyTrustHubEmpty>
          )}
        </article>
        <article className="myth-panel">
          <div className="myth-panel-heading"><h2>Privacy</h2></div>
          <LockKeyhole aria-hidden="true" />
          <p>
            Saved Research belongs to your consumer workspace. Businesses cannot
            see your shortlist.
          </p>
        </article>
      </section>
    </MyTrustHubShell>
  );
}
