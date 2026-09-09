import { redirect } from "next/navigation";
import { AdminShell } from "../../../admin-shell";
import { withAdminSecurity } from "@/lib/control-plane/server";
import { ClaimOperationsService } from "@/lib/control-plane/claim-operations";
import { hasAdminPermission } from "@/lib/control-plane/rbac";
import { ClaimDecisionForm } from "./claim-decision-form";
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
      const detail = await new ClaimOperationsService(sql, s, t, c).detail(id);
      return { staff, detail };
    });
  } catch {
    redirect("/admin/operations/claims");
  }
  const d = data.detail,
    c = d.claim,
    q = d.queue,
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
          {q.workflowState}
        </p>
      </header>
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
