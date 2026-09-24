import { redirect } from "next/navigation";
import { AdminShell } from "../../../admin-shell";
import { withAdminSecurity } from "@/lib/control-plane/server";
import { ClaimOperationsService } from "@/lib/control-plane/claim-operations";
import { hasAdminPermission } from "@/lib/control-plane/rbac";
import { ClaimDecisionForm } from "./claim-decision-form";
import { ReviewTimer } from "./review-timer";
import { REVIEW_SLA_LABEL } from "@/lib/customer/review-sla";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Claim Review | Ask Trust Hub",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ claimId: string }>;
}) {
  const { id } = { id: (await params).claimId };
  let data;
  try {
    data = await withAdminSecurity(async (s, t, c, sql) => {
      const staff = await s.require(t, "ADMIN_VIEW");
      const service = new ClaimOperationsService(sql, s, t, c);
      const detail = await service.detail(id);
      const timing = await service.timing(id);
      return { staff, detail, timing };
    });
  } catch {
    redirect("/admin/operations/claims");
  }
  const d = data.detail,
    c = d.claim,
    q = d.queue,
    timing = data.timing,
    canWrite = hasAdminPermission(data.staff.role, "CLAIM_OPS");
  return (
    <AdminShell staff={data.staff}>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo">
          Claim case {q.caseId.slice(0, 8)}
        </p>
        <h2 className="mt-1 text-3xl font-semibold text-navy">
          {String(c.display_name_snapshot)}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Claim status: {String(c.status)} · Policy: {q.policy.result} · Case:{" "}
          {q.workflowState} · Source: {q.acquisitionSource}
        </p>
        {!timing ? (
          <p role="status" className="mt-2 rounded-lg border border-amber-600 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Claim V2 schema (migration 019) is not applied yet. Decisions and revocation still work; the review timer,
            review target and source attribution are unavailable until it is applied. No claim data was changed.
          </p>
        ) : q.isOpen ? (
          <p className={`mt-2 inline-block rounded-full border px-3 py-1 text-sm font-semibold ${timing.sla.state === "OVER_TARGET" ? "border-amber-600 bg-amber-50 text-amber-800" : "border-border"}`}>
            {REVIEW_SLA_LABEL[timing.sla.state]} · {Math.round(timing.sla.businessHoursOpen)} business hours open
          </p>
        ) : null}
      </header>
      {timing ? <ReviewTimer
        claimId={id}
        openSession={timing.openSession}
        humanReviewActiveSeconds={timing.humanReviewActiveSeconds}
        evidenceReady={timing.evidenceReadyAtFirstReview}
        firstReview={!timing.reviewStartedAt}
        canWrite={canWrite && q.isOpen}
      /> : null}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Exact specialist identity">
          <Fact label="Hub / class" value={`${q.hub} / ${q.profileClass}`} />
          <Fact
            label="Identifier"
            value={`${String(c.identifier_namespace)} ${String(c.native_credential_key)}`}
          />
          <Fact
            label="Native source / profile"
            value={`${String(c.native_source_system)} / ${String(c.native_profile_id)}`}
          />
          <Fact
            label="Principal jurisdiction"
            value={q.jurisdiction ?? "Not represented"}
          />
        </Panel>
        <Panel title="Claimant / organization relationship">
          <Fact label="Claimant" value={String(c.claimant_email)} />
          <Fact
            label="Email"
            value={`${c.email_confirmed_at ? "Confirmed" : "Not confirmed"} / ${c.free_email ? "free-email step-up" : "not free-email classified"}`}
          />
          <Fact label="Relationship" value={String(c.relationship_type)} />
          <Fact label="Organization" value={String(c.org_name)} />
        </Panel>
        <Panel title="Policy evaluation">
          <Fact label="Policy version" value={q.policy.policyVersion} />
          <Fact label="Result" value={q.policy.result} />
          <Fact
            label="Auto approval"
            value="OFF — human confirmation required"
          />
          <Fact
            label="Missing evidence"
            value={
              q.policy.missingEvidence.join(", ") ||
              "None in current evaluation"
            }
          />
          <Fact
            label="Step-up / conflict"
            value={
              [...q.policy.stepUpReasons, ...q.policy.conflicts].join(", ") ||
              "None"
            }
          />
        </Panel>
        {timing ? <Panel title="Review timing (capacity instrumentation)">
          <Fact label="Submitted" value={new Date(timing.submittedAt).toISOString()} />
          <Fact label="Review started" value={timing.reviewStartedAt ? new Date(timing.reviewStartedAt).toISOString() : "Not started"} />
          <Fact label="Decided" value={timing.reviewDecidedAt ? new Date(timing.reviewDecidedAt).toISOString() : "No final decision"} />
          <Fact label="Evidence ready at first review" value={timing.evidenceReadyAtFirstReview === null ? "Not recorded" : timing.evidenceReadyAtFirstReview ? "Yes" : "No"} />
          <Fact label="Human review time" value={`${Math.round((timing.humanReviewActiveSeconds / 60) * 10) / 10} min across ${timing.sessions.length} session(s)`} />
          <Fact label="Elapsed (wall clock, not labor)" value={`${Math.round(q.ageHours)} h`} />
        </Panel> : null}
        <Panel title="Authority constraints">
          <Fact
            label="Active management grant"
            value={
              q.existingGrant ? "Present — unsafe approval blocked" : "None"
            }
          />
          <Fact label="Competing claims" value={String(q.competingClaims)} />
          <Fact
            label="Organization memberships"
            value={
              d.memberships
                .map((m) => `${String(m.role)} (${String(m.status)})`)
                .join(", ") || "None"
            }
          />
        </Panel>
      </div>
      <Panel title="Claim timeline and domain audit">
        {d.audit.length ? (
          <ul className="space-y-2 text-sm">
            {d.audit.map((a, i) => (
              <li key={i}>
                {String(a.action)} · {String(a.actor_kind)} ·{" "}
                {new Date(String(a.created_at)).toLocaleString("en-US", {
                  timeZone: "UTC",
                })}{" "}
                UTC
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No recorded domain events.
          </p>
        )}
      </Panel>
      <Panel title="Policy evaluation history">
        {d.evaluations.length ? (
          <ul className="space-y-2 text-sm">
            {d.evaluations.map((e, i) => (
              <li key={i}>
                {String(e.result)} · {String(e.policy_version)} ·{" "}
                {new Date(String(e.evaluated_at)).toLocaleString("en-US", {
                  timeZone: "UTC",
                })}{" "}
                UTC
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No decision-time evaluation recorded yet.
          </p>
        )}
      </Panel>
      {canWrite ? (
        <ClaimDecisionForm
          claimId={id}
          grantId={d.grant ? String(d.grant.id) : undefined}
          policyResult={q.policy.result}
        />
      ) : (
        <p className="card-surface p-5 text-sm">
          <strong>Read only.</strong> This role can inspect aggregate and claim
          evidence but cannot decide or revoke.
        </p>
      )}
    </AdminShell>
  );
}
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface p-5">
      <h3 className="text-lg font-semibold text-navy">{title}</h3>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm">
      <span className="font-semibold">{label}:</span>{" "}
      <span className="break-words text-muted-foreground">{value}</span>
    </p>
  );
}
