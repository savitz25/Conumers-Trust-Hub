import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  FolderKanban,
} from "lucide-react";
import {
  MyTrustHubEmpty,
  MyTrustHubShell,
  PageHeading,
} from "@/components/my-trusthub/my-shell";
import { isMyTrustHubCanaryOnly } from "@/lib/my-trusthub/canary-access";
import { getEnabledAdapter } from "@/lib/my-trusthub/page-data";

export default async function MyTrustHubHome() {
  const adapter = await getEnabledAdapter();
  const user = adapter ? await adapter.getUser() : null;
  const canaryOnly = isMyTrustHubCanaryOnly();

  if (!adapter || !user) {
    return (
      <main className="myth-lander">
        <div className="myth-lander-inner">
          <p className="myth-eyebrow">MY TRUSTHUB</p>
          <h1>
            {canaryOnly
              ? "Internal canary access"
              : "Save it. Organize it. You decide."}
          </h1>
          <p>
            {canaryOnly
              ? "My TrustHub is available only to approved internal test accounts during this launch gate."
              : "Keep private research and organize life-event Projects."}
          </p>
          <Link className="myth-primary" href="/my/sign-in">
            Sign in to My TrustHub
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
          <p className="myth-disclosure">
            TrustHub organizes research. It does not approve, rank, or recommend
            your selection.
          </p>
        </div>
      </main>
    );
  }

  const [projects, saved] = await Promise.all([
    adapter.listProjects(),
    adapter.listSavedEntities(),
  ]);
  const activeProjects = projects.filter((project) => project.status === "active");
  const activeSaved = saved.filter((item) => !item.removed_at);
  const unfiled = activeSaved.filter((item) => item.project_ids.length === 0);

  return (
    <MyTrustHubShell active="Home" email={user.email ?? "Signed in"}>
      <PageHeading eyebrow="MY TRUSTHUB" title="Your research workspace">
        Your Saved Research and Projects—kept together privately.
      </PageHeading>
      <section className="myth-grid">
        <article className="myth-panel myth-span-two">
          <div className="myth-panel-heading">
            <h2>Active Projects</h2>
            <Link href="/my/projects">View all</Link>
          </div>
          {activeProjects.length ? activeProjects.map((project) => (
            <Link
              className="myth-row"
              key={project.project_id}
              href={`/my/projects/${project.project_id}`}
            >
              <FolderKanban aria-hidden="true" />
              <span>
                <strong>{project.name}</strong>
                <small>
                  {project.saved_count} Saved records ·{" "}
                  {project.life_event_type.replaceAll("_", " ")}
                </small>
              </span>
              <ArrowRight aria-hidden="true" />
            </Link>
          )) : (
            <MyTrustHubEmpty title="Start with a Project">
              <p>
                Projects organize a life event, but saving research without one
                is always allowed.
              </p>
              <Link className="myth-primary" href="/my/projects">
                Create a Project
              </Link>
            </MyTrustHubEmpty>
          )}
        </article>
        <article className="myth-panel">
          <div className="myth-panel-heading"><h2>Workspace</h2></div>
          <dl className="myth-stats">
            <div>
              <dt><Bookmark aria-hidden="true" />Saved</dt>
              <dd>{activeSaved.length}</dd>
            </div>
            <div>
              <dt><FolderKanban aria-hidden="true" />Projects</dt>
              <dd>{activeProjects.length}</dd>
            </div>
          </dl>
          <p className="myth-muted">
            Counts come from your private consumer workspace and do not affect
            public profiles.
          </p>
        </article>
        <article className="myth-panel myth-span-three">
          <div className="myth-panel-heading">
            <h2>Unfiled research</h2>
            <Link href="/my/saved">Review</Link>
          </div>
          <p className="myth-large-number">{unfiled.length}</p>
          <p className="myth-muted">Saved records do not need a Project.</p>
        </article>
      </section>
    </MyTrustHubShell>
  );
}
