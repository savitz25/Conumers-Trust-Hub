import { Bookmark, LockKeyhole } from "lucide-react";
import {
  addSavedToProjectAction,
  createPrivateNoteAction,
  deletePrivateNoteAction,
  removeSavedFromProjectAction,
  saveCanaryEntityAction,
  updatePrivateNoteAction,
} from "@/app/my/actions";
import { GuestRestore } from "@/components/my-trusthub/guest-restore";
import {
  MyTrustHubEmpty,
  MyTrustHubShell,
  PageHeading,
} from "@/components/my-trusthub/my-shell";
import { isMyTrustHubFeatureEnabled } from "@/lib/my-trusthub/feature-flags";
import { requireWorkspace } from "@/lib/my-trusthub/page-data";

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string; error?: string }>;
}) {
  const { adapter, user } = await requireWorkspace();
  const [{ import: importState, error }, saved, projects, notes] = await Promise.all([
    searchParams,
    adapter.listSavedEntities(),
    adapter.listProjects(),
    adapter.listNotes(),
  ]);
  const active = saved.filter((item) => !item.removed_at);
  const activeProjects = projects.filter((project) => project.status === "active");
  const canSave = isMyTrustHubFeatureEnabled("MY_TRUSTHUB_SAVED_ENABLED");

  return (
    <MyTrustHubShell active="Saved" email={user.email ?? "Signed in"}>
      <PageHeading eyebrow="PRIVATE RESEARCH LIBRARY" title="Saved Research">
        Saved profiles stay available whether or not they belong to a Project.
      </PageHeading>
      {importState === "complete" ? <p className="myth-notice" role="status">Guest research restored. Existing Saves were kept once.</p> : null}
      {importState === "invalid" ? <p className="myth-warning" role="alert">That guest research could not be restored safely.</p> : null}
      {error ? <p className="myth-warning" role="alert">That change could not be completed. Refresh and try again.</p> : null}
      <GuestRestore projects={activeProjects} importComplete={importState === "complete"} />
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
              <details className="myth-inline-details">
                <summary>Projects and private notes</summary>
                <div className="myth-membership-grid">
                  {activeProjects.map((project) => {
                    const assigned = item.project_ids.includes(project.project_id);
                    return (
                      <form action={assigned ? removeSavedFromProjectAction : addSavedToProjectAction} key={project.project_id}>
                        <input type="hidden" name="projectId" value={project.project_id} />
                        <input type="hidden" name="savedEntityId" value={item.saved_entity_id} />
                        <span>{project.name}</span>
                        <button className="myth-secondary" type="submit">{assigned ? "Remove" : "Add"}</button>
                      </form>
                    );
                  })}
                  {!activeProjects.length ? <p className="myth-muted">Create an active Project to file this research.</p> : null}
                </div>
                <div aria-label={`Private notes for ${item.canonical_name}`}>
                  {notes.filter((note) => note.saved_entity_id === item.saved_entity_id).map((note) => (
                    <form action={updatePrivateNoteAction} className="myth-note myth-form" key={note.id}>
                      <input type="hidden" name="noteId" value={note.id} />
                      <input type="hidden" name="rowVersion" value={note.row_version} />
                      <label htmlFor={`note-type-${note.id}`}>Note type</label>
                      <select id={`note-type-${note.id}`} name="noteType" defaultValue={note.note_type}>
                        <option value="general">General</option><option value="research">Research</option><option value="reminder">Reminder</option>
                      </select>
                      <label htmlFor={`note-body-${note.id}`}>Private note</label>
                      <textarea id={`note-body-${note.id}`} name="body" defaultValue={note.body} maxLength={4000} rows={3} required />
                      <div className="myth-actions">
                        <button className="myth-secondary" type="submit">Save note</button>
                        <button className="myth-text-danger" formAction={deletePrivateNoteAction} type="submit">Delete note</button>
                      </div>
                    </form>
                  ))}
                  <form action={createPrivateNoteAction} className="myth-note myth-form">
                    <input type="hidden" name="savedEntityId" value={item.saved_entity_id} />
                    <input type="hidden" name="noteType" value="research" />
                    <label htmlFor={`new-note-${item.saved_entity_id}`}>Add a private note</label>
                    <textarea id={`new-note-${item.saved_entity_id}`} name="body" maxLength={4000} rows={3} required />
                    <button className="myth-secondary" type="submit">Add note</button>
                  </form>
                </div>
              </details>
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
