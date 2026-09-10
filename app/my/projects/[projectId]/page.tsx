import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, RotateCcw } from "lucide-react";
import {
  addSavedToProjectAction,
  archiveProjectAction,
  removeSavedFromProjectAction,
  restoreProjectAction,
  updateProjectAction,
} from "@/app/my/actions";
import {
  MyTrustHubEmpty,
  MyTrustHubShell,
  PageHeading,
} from "@/components/my-trusthub/my-shell";
import { requireWorkspace } from "@/lib/my-trusthub/page-data";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const [{ projectId }, workspace, query] = await Promise.all([
    params,
    requireWorkspace(),
    searchParams,
  ]);
  const { adapter, user } = workspace;
  const [project, memberships, saved] = await Promise.all([
    adapter.getProject(projectId),
    adapter.getProjectMemberships(projectId),
    adapter.listSavedEntities(),
  ]);
  if (!project) notFound();

  const savedById = new Map(saved.map((item) => [item.saved_entity_id, item]));
  const activeMemberships = memberships.filter((item) => item.removed_at === null);
  const activeIds = new Set(
    activeMemberships.map((item) => String(item.saved_entity_id)),
  );
  const available = saved.filter(
    (item) => !item.removed_at && !activeIds.has(item.saved_entity_id),
  );
  const status = String(project.status);
  const rowVersion = Number(project.row_version);

  return (
    <MyTrustHubShell active="Projects" email={user.email ?? "Signed in"}>
      <PageHeading
        eyebrow={`${status.toUpperCase()} PROJECT`}
        title={String(project.name)}
      >
        {String(project.life_event_type).replaceAll("_", " ")} · Saved
        Research stays preserved through archive and restore.
      </PageHeading>
      {query.updated ? <p className="myth-notice" role="status">Project updated.</p> : null}
      {query.error ? <p className="myth-warning" role="alert">That Project change could not be completed. Refresh and try again.</p> : null}
      <details className="myth-create">
        <summary>Edit Project</summary>
        <form action={updateProjectAction} className="myth-form myth-form-grid">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="rowVersion" value={rowVersion} />
          <label htmlFor="edit-project-name">Project name</label>
          <input id="edit-project-name" name="name" defaultValue={String(project.name)} required maxLength={120} />
          <label htmlFor="edit-target-date">Target date <span>(optional)</span></label>
          <input id="edit-target-date" name="targetDate" type="date" defaultValue={project.target_date ? String(project.target_date) : ""} />
          <button className="myth-primary" type="submit">Save changes</button>
        </form>
      </details>
      <div className="myth-actions">
        {status === "active" ? (
          <form action={archiveProjectAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="rowVersion" value={rowVersion} />
            <button className="myth-secondary" type="submit">
              <Archive aria-hidden="true" />Archive
            </button>
          </form>
        ) : (
          <form action={restoreProjectAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="rowVersion" value={rowVersion} />
            <button className="myth-primary" type="submit">
              <RotateCcw aria-hidden="true" />Restore Project
            </button>
          </form>
        )}
      </div>
      <section className="myth-grid">
        <article className="myth-panel myth-span-two">
          <div className="myth-panel-heading">
            <h2>Saved Research</h2>
            <Link href="/my/saved">Manage</Link>
          </div>
          {activeMemberships.length ? activeMemberships.map((membership) => {
            const savedEntityId = String(membership.saved_entity_id);
            const item = savedById.get(savedEntityId);
            return (
              <div className="myth-row" key={savedEntityId}>
                <span>
                  <strong>{item?.canonical_name ?? "Saved record"}</strong>
                  <small>{item?.primary_hub ?? "TrustHub"}</small>
                </span>
                <form action={removeSavedFromProjectAction}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="savedEntityId" value={savedEntityId} />
                  <button className="myth-secondary" type="submit">Remove</button>
                </form>
              </div>
            );
          }) : (
            <MyTrustHubEmpty title="No Saved Research in this Project">
              <p>Add the controlled Saved entity below.</p>
            </MyTrustHubEmpty>
          )}
        </article>
        <article className="myth-panel">
          <div className="myth-panel-heading"><h2>Add Saved Research</h2></div>
          {available.length ? available.map((item) => (
            <form
              action={addSavedToProjectAction}
              className="myth-row"
              key={item.saved_entity_id}
            >
              <input type="hidden" name="projectId" value={projectId} />
              <input
                type="hidden"
                name="savedEntityId"
                value={item.saved_entity_id}
              />
              <span>
                <strong>{item.canonical_name}</strong>
                <small>{item.primary_hub}</small>
              </span>
              <button className="myth-secondary" type="submit">Add</button>
            </form>
          )) : (
            <p className="myth-muted">No unfiled Saved Research is available.</p>
          )}
        </article>
      </section>
    </MyTrustHubShell>
  );
}
