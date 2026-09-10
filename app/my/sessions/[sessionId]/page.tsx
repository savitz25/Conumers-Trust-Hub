import { notFound } from "next/navigation";
import { addSessionToProjectAction, removeSessionFromProjectAction, resumeSavedSessionAction, updateMoveInventorySessionAction } from "@/app/my/actions";
import { MyTrustHubShell, PageHeading } from "@/components/my-trusthub/my-shell";
import { requireWorkspace } from "@/lib/my-trusthub/page-data";

export default async function SavedSessionPage({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ updated?: string; resume?: string; error?: string }> }) {
  const [{ sessionId }, query, { adapter, user }] = await Promise.all([params, searchParams, requireWorkspace()]);
  const [session, summaries, projects] = await Promise.all([adapter.getSavedSession(sessionId), adapter.listSavedSessions(), adapter.listProjects()]);
  if (!session) notFound();
  const summary = summaries.find((item) => item.saved_session_id === sessionId);
  if (!summary) notFound();
  const assigned = new Set(summary.project_memberships.map((item) => item.project_ref));
  const roomCounts = session.payload.room_counts && typeof session.payload.room_counts === "object" ? session.payload.room_counts as Record<string, unknown> : {};
  const rooms = Number(roomCounts.total ?? 1);
  const volume = Number(session.payload.estimated_cubic_feet ?? 50);

  return (
    <MyTrustHubShell active="Saved" email={user.email ?? "Signed in"}>
      <PageHeading eyebrow={`${session.hub.toUpperCase()} · SAVED ${session.session_type.toUpperCase()}`} title={String(session.summary.title ?? "Saved research session")}>Last worked on {new Date(session.updated_at).toLocaleDateString()}. This is private planning state, not current regulatory evidence.</PageHeading>
      {query.updated ? <p className="myth-notice" role="status">Research session updated.</p> : null}
      {query.error ? <p className="myth-warning" role="alert">That change could not be completed safely.</p> : null}
      {query.resume === "hub-unavailable" ? <p className="myth-warning" role="status">This session is preserved and compatible. Resume in Move Trust Hub is not available yet.</p> : null}
      {query.resume === "unsupported" ? <p className="myth-warning" role="alert">This version cannot be resumed yet. Your saved research was preserved unchanged.</p> : null}
      <section className="myth-grid">
        <article className="myth-panel myth-span-two">
          <div className="myth-panel-heading"><h2>Saved inventory</h2><span>Version {session.schema_version}</span></div>
          <dl className="myth-stats"><div><dt>Rooms included</dt><dd>{rooms}</dd></div><div><dt>Estimated cubic feet</dt><dd>{volume}</dd></div></dl>
          <form action={resumeSavedSessionAction}><input type="hidden" name="sessionId" value={sessionId} /><button className="myth-primary" type="submit">Resume</button></form>
        </article>
        <article className="myth-panel">
          <div className="myth-panel-heading"><h2>Projects</h2></div>
          <div className="myth-membership-grid">{projects.filter((project) => project.status === "active").map((project) => <form action={assigned.has(project.project_id) ? removeSessionFromProjectAction : addSessionToProjectAction} key={project.project_id}><input type="hidden" name="sessionId" value={sessionId} /><input type="hidden" name="projectId" value={project.project_id} /><span>{project.name}</span><button className="myth-secondary" type="submit">{assigned.has(project.project_id) ? "Remove" : "Add"}</button></form>)}</div>
        </article>
        {session.schema_key === "move.inventory/v1" && session.status === "active" ? <article className="myth-panel myth-span-three"><div className="myth-panel-heading"><h2>Update working session</h2></div><form action={updateMoveInventorySessionAction} className="myth-form myth-form-grid"><input type="hidden" name="sessionId" value={sessionId} /><input type="hidden" name="rowVersion" value={session.row_version} /><label htmlFor="edit-session-title">Session name</label><input id="edit-session-title" name="title" defaultValue={String(session.summary.title ?? "Moving inventory estimate")} required maxLength={120} /><label htmlFor="edit-session-rooms">Rooms included</label><input id="edit-session-rooms" name="rooms" type="number" min={1} max={20} defaultValue={rooms} required /><label htmlFor="edit-session-volume">Estimated cubic feet</label><input id="edit-session-volume" name="estimatedCubicFeet" type="number" min={50} max={20000} defaultValue={volume} required /><button className="myth-primary" type="submit">Save changes</button></form></article> : null}
      </section>
    </MyTrustHubShell>
  );
}
