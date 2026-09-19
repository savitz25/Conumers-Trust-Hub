import Link from "next/link";
import { Archive, ArrowRight, FolderKanban } from "lucide-react";
import { createProjectAction } from "@/app/my/actions";
import { MyTrustHubEmpty, MyTrustHubShell, PageHeading } from "@/components/my-trusthub/my-shell";
import { isMyTrustHubFeatureEnabled } from "@/lib/my-trusthub/feature-flags";
import { requireWorkspace } from "@/lib/my-trusthub/page-data";

const templates = [
  ["Buying a home", "buying_home"],
  ["Moving", "moving"],
  ["Helping an aging parent", "aging_parent"],
  ["Hiring a contractor", "contractor"],
  ["Protecting what matters", "protecting"],
  ["Researching an adviser", "adviser_research"],
  ["Blank Project", "blank"],
] as const;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { adapter, user } = await requireWorkspace();
  const [projects, { error }] = await Promise.all([adapter.listProjects(), searchParams]);
  const canCreate = isMyTrustHubFeatureEnabled("MY_TRUSTHUB_PROJECTS_ENABLED");
  return (
    <MyTrustHubShell active="Projects" email={user.email ?? "Signed in"}>
      <PageHeading eyebrow="PROJECTS / LIFE EVENTS" title="Projects">
        Organize saved research around a decision. A Project is optional.
      </PageHeading>
      {error ? <p className="myth-warning" role="alert">That Project change could not be completed. Refresh and try again.</p> : null}
      {canCreate ? (
        <details className="myth-create">
          <summary>Create Project</summary>
          <form action={createProjectAction} className="myth-form myth-form-grid">
            <label htmlFor="project-name">Project name</label>
            <input id="project-name" name="name" required maxLength={120} />
            <label htmlFor="life-event">Life event</label>
            <select id="life-event" name="lifeEventType" defaultValue="blank">
              {templates.map(([label, value]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <label htmlFor="target-date">Target date <span>(optional)</span></label>
            <input id="target-date" name="targetDate" type="date" />
            <button className="myth-primary" type="submit">Create Project</button>
          </form>
        </details>
      ) : <p className="myth-warning">Project mutations are disabled by the launch gate.</p>}
      {projects.length ? (
        <div className="myth-list">{projects.map((project) => (
          <Link className="myth-row myth-row-card" key={project.project_id} href={`/my/projects/${project.project_id}`}>
            {project.status === "archived" ? <Archive aria-hidden="true" /> : <FolderKanban aria-hidden="true" />}
            <span><strong>{project.name}</strong><small>{project.status} · {project.saved_count} Saved · Updated {new Date(project.updated_at).toLocaleDateString()}</small></span>
            <ArrowRight aria-hidden="true" />
          </Link>
        ))}</div>
      ) : <MyTrustHubEmpty title="No Projects yet"><p>Save research first or create a Project when it helps organize a decision.</p></MyTrustHubEmpty>}
    </MyTrustHubShell>
  );
}
