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
      const rows = await new ClaimOperationsService(sql, s, t, c).list(filter);
      return { staff, rows };
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
        <table className="min-w-[1050px] w-full text-left text-sm">
          <thead>
            <tr>
              {[
                "Age",
                "Hub / class",
                "Profile identity",
                "Claim",
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
              <tr key={r.claimId}>
                <td className="border-b p-3">
                  {r.ageBand}
                  <span className="block text-xs text-muted-foreground">
                    {Math.round(r.ageHours)}h
                  </span>
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
        Aging uses a 72-hour internal operating target. It is not a public SLA.
      </p>
    </AdminShell>
  );
}
