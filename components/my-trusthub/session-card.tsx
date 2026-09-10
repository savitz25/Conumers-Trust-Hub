import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import type { SavedSessionSummaryRow } from "@/lib/my-trusthub/production-adapter";

function summaryLine(session: SavedSessionSummaryRow): string {
  const primary = session.summary.primary_value;
  const unit = session.summary.unit;
  const label = session.summary.label;
  return [primary === undefined ? null : `${primary}${unit ? ` ${unit}` : ""}`, label]
    .filter(Boolean).join(" · ") || "Saved research state";
}

export function SessionCard({ session }: { session: SavedSessionSummaryRow }) {
  return (
    <article className="myth-session-card">
      <div>
        <p className="myth-eyebrow">{session.hub.toUpperCase()} TRUST HUB</p>
        <h3>{session.title}</h3>
        <p>{summaryLine(session)}</p>
        <p className="myth-muted"><Clock3 aria-hidden="true" size={15} /> Last worked on {new Date(session.last_activity_at).toLocaleDateString()}</p>
        <p className="myth-muted">{session.session_type} · {session.project_memberships.length ? `${session.project_memberships.length} Project${session.project_memberships.length === 1 ? "" : "s"}` : "Unfiled"}</p>
      </div>
      <Link className="myth-secondary" href={`/my/sessions/${session.saved_session_id}`}>
        Continue research <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </article>
  );
}
