import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "../../admin-shell";
import { withAdminSecurity } from "@/lib/control-plane/server";
import {
  ClaimOperationsService,
  type ClaimQueueFilter,
} from "@/lib/control-plane/claim-operations";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Claim Operations | Ask Trust Hub",
  robots: { index: false, follow: false },
};
const filters = [
  "all",
  "pending",
  "green",
  "amber",
  "red",
  "not_defined",
  "competing",
  "existing_grant",
  "waiting",
  "aged",
] as const;
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const raw = (await searchParams).filter ?? "pending",
    filter = (filters as readonly string[]).includes(raw)
      ? (raw as ClaimQueueFilter)
      : "pending";
  let data;
  try {
    data = await withAdminSecurity(async (s, t, c, sql) => {
      const staff = await s.require(t, "ADMIN_VIEW");
      const service = new ClaimOperationsService(sql, s, t, c);
      const schemaReady = await service.schemaReady();
      const rows = await service.list(filter);
      return { staff, rows, schemaReady };
    });
  } catch {
    redirect("/admin/login");
  }
  return (
    <AdminShell staff={data.staff}>
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo">
          Trust Operations
        </p>
        <h2 className="mt-1 text-3xl font-semibold text-navy">
          Claim Operations
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Exact-profile authority review. Claims never change Layer A evidence,
          ranking, or publication.
        </p>
        {!data.schemaReady ? (
          <p role="status" className="mt-3 rounded-lg border border-amber-600 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Claim V2 schema (migration 019) is not applied yet. The queue and decisions work in legacy mode; source,
            review timer and review-target columns are unavailable until it is applied.
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="Open claim summary">
          <div className={`rounded-xl border p-4 ${data.rows.filter((r) => r.isOpen).length ? "border-indigo" : "border-border"}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Open claims</p>
            <p className="mt-1 text-3xl font-semibold text-navy">{data.rows.filter((r) => r.isOpen).length}</p>
          </div>
          <div className={`rounded-xl border p-4 ${data.rows.some((r) => r.isOpen && r.slaState === "OVER_TARGET") ? "border-amber-500 bg-amber-50" : "border-border"}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Over the 2-business-day target</p>
            <p className="mt-1 text-3xl font-semibold text-navy">{data.rows.filter((r) => r.isOpen && r.slaState === "OVER_TARGET").length}</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Waiting for claimant</p>
            <p className="mt-1 text-3xl font-semibold text-navy">{data.rows.filter((r) => r.claimStatus === "needs_info").length}</p>
          </div>
        </div>
        <nav aria-label="Claim filters" className="mt-5 flex flex-wrap gap-2">
          {filters.map((f) => (
            <Link
              key={f}
              href={`/admin/operations/claims?filter=${f}`}
              className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold ${f === filter ? "border-indigo text-indigo" : "border-border text-navy"}`}
            >
              {f.replaceAll("_", " ")}
            </Link>
          ))}
        </nav>
      </section>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-[1250px] w-full text-left text-sm">
          <thead>
            <tr>
              {[
                "Age / SLA",
                "Hub / class",
                "Profile identity",
                "Claim",
                "Source / relationship",
                "Policy",
                "Conflicts",
                "Reviewer",
                "Next",
              ].map((h) => (
                <th className="border-b p-3" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr
                key={r.claimId}
                data-sla-state={r.slaState}
                className={r.isOpen && r.slaState === "OVER_TARGET" ? "border-l-4 border-l-amber-500 bg-amber-50/60" : r.isOpen && r.slaState === "APPROACHING_TARGET" ? "border-l-4 border-l-indigo/60" : r.isOpen ? "" : "text-muted-foreground"}
              >
                <td className="border-b p-3">
                  {r.ageBand}
                  <span className="block text-xs text-muted-foreground">
                    {Math.round(r.ageHours)}h · {Math.round(r.businessHoursOpen)} business h
                  </span>
                  {r.isOpen ? (
                    <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${r.slaState === "OVER_TARGET" ? "border-amber-600 text-amber-800" : r.slaState === "APPROACHING_TARGET" ? "border-indigo text-indigo" : "border-border"}`}>
                      {r.slaLabel}
                    </span>
                  ) : null}
                </td>
                <td className="border-b p-3">
                  {r.hub}
                  <span className="block">{r.profileClass}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.jurisdiction ?? "No state"}
                  </span>
                </td>
                <td className="border-b p-3">
                  <span className="font-semibold text-navy">
                    {r.displayName}
                  </span>
                  <span className="block break-all text-xs">
                    {r.identifierNamespace} {r.identifier}
                  </span>
                </td>
                <td className="border-b p-3">
                  {r.claimStatus}
                  <span className="block text-xs">{r.workflowState}</span>
                </td>
                <td className="border-b p-3">
                  <span className={r.acquisitionSource === "internal_test" ? "rounded border border-dashed px-1 text-xs" : ""}>{r.acquisitionSource}</span>
                  <span className="block text-xs text-muted-foreground">{r.relationshipType.replaceAll("_", " ")}</span>
                </td>
                <td className="border-b p-3">
                  <span className="rounded-full border px-2 py-1 text-xs font-bold">
                    {r.policy.result}
                  </span>
                </td>
                <td className="border-b p-3">
                  {r.competingClaims
                    ? `${r.competingClaims} competing`
                    : "No competing"}
                  <span className="block">
                    {r.existingGrant ? "Active grant" : "No active grant"}
                  </span>
                </td>
                <td className="border-b p-3">
                  {r.assignedRole ?? "Unassigned"}
                </td>
                <td className="border-b p-3">
                  <Link
                    className="link-inline inline-flex min-h-11 items-center"
                    href={`/admin/operations/claims/${r.claimId}`}
                  >
                    {r.nextAction}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No claims match this filter. An empty Production queue is valid.
          </p>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Open claims are ordered needs-information first, then oldest submitted, then in review. The
        2-business-day (Mon–Fri, no holiday model) target is an internal trial operating target, not a public
        or legal SLA, and pauses while a claim is waiting on the claimant.
        Rows labelled internal_test are synthetic QA and are excluded from external funnel metrics.
      </p>
    </AdminShell>
  );
}
