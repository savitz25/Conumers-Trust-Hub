import { createPageMetadata } from "@/lib/seo/metadata";
import { AuthError } from "@/lib/customer/store";
import { readSessionToken, withPlatform } from "@/lib/customer/server";
import { customerHub } from "@/lib/customer/hub-registry";
import type { CustomerHubId } from "@/lib/customer/types";
import { ReviewActions } from "./review-actions";
export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "Review claim",
  description: "Staff-only Ask Trust Hub claim decision.",
  path: "/internal/review",
  noIndex: true,
});
export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    sessionToken = await readSessionToken();
  try {
    const detail = await withPlatform((p) =>
        p.getReviewDetail(sessionToken || "", id),
      ),
      claim = detail.claim,
      hub = customerHub(String(claim.hub_id) as CustomerHubId);
    return (
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-12">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo">
            Staff authority review
          </p>
          <h1 className="text-2xl font-semibold text-navy">Review request</h1>
          <p className="text-sm text-muted-foreground">
            Profile identity is not claimant authority. Human approval and
            structured independent evidence are required.
          </p>
        </header>
        <dl className="card-surface grid gap-3 p-5 text-sm">
          <div>
            <dt className="text-muted-foreground">Claimant</dt>
            <dd className="break-all">{String(claim.claimant_email)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              Email confirmed / free email
            </dt>
            <dd>
              {claim.email_confirmed_at ? "Confirmed" : "Not confirmed"}{" "}
              &middot;{" "}
              {claim.free_email
                ? "Free email — enhanced review"
                : "Not classified as free email"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Profile</dt>
            <dd>{String(claim.display_name_snapshot)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Trust Hub / class</dt>
            <dd>
              {hub?.displayName || String(claim.hub_id)} &middot; {String(claim.entity_class)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Public identifier</dt>
            <dd className="break-all">
              {String(claim.identifier_namespace || "Identifier")}{" "}
              {String(claim.native_credential_key)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              Source system / profile ID
            </dt>
            <dd className="break-all">
              {String(claim.native_source_system)} &middot;{" "}
              {String(claim.native_profile_id)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Relationship attestation</dt>
            <dd>{String(claim.relationship_type)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Organization</dt>
            <dd>{String(claim.org_name)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Claim status</dt>
            <dd>{String(claim.status)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Active management grant</dt>
            <dd>
              {detail.grant
                ? "Present — approval is blocked until resolved"
                : "None"}
            </dd>
          </div>
          {claim.canonical_url ? (
            <div>
              <dt className="text-muted-foreground">Specialist profile</dt>
              <dd>
                <a
                  className="text-indigo underline"
                  href={String(claim.canonical_url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open current public profile
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
        <section>
          <h2 className="font-semibold">Competing claims and conflicts</h2>
          <ul className="mt-2 text-sm text-muted-foreground">
            {detail.competing.map((c) => (
              <li key={String(c.id)}>
                {String(c.status)} &middot; submitted{" "}
                {new Date(String(c.created_at)).toLocaleString()}
              </li>
            ))}
            {detail.competing.length === 0 ? <li>None</li> : null}
          </ul>
        </section>
        <section>
          <h2 className="font-semibold">Existing organization relationships</h2>
          <ul className="mt-2 text-sm text-muted-foreground">
            {detail.memberships.map((m, i) => (
              <li key={i}>
                {String(m.org_name)} &middot; {String(m.role)} &middot;{" "}
                {String(m.status)}
              </li>
            ))}
            {detail.memberships.length === 0 ? <li>None</li> : null}
          </ul>
        </section>
        <section>
          <h2 className="font-semibold">Decision audit</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {detail.audit.map((a, i) => (
              <li key={i}>
                {String(a.action)} &middot; {String(a.actor_kind)} &middot;{" "}
                {new Date(String(a.created_at)).toLocaleString()}
                {a.after_state ? <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{JSON.stringify(a.after_state,null,2)}</pre> : null}
              </li>
            ))}
            {detail.audit.length === 0 ? (
              <li>No decision events yet.</li>
            ) : null}
          </ul>
        </section>
        <ReviewActions
          claimId={id}
          grantId={detail.grant ? String(detail.grant.id) : undefined}
        />
      </main>
    );
  } catch (e) {
    const code = e instanceof AuthError ? e.code : "unavailable";
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <p>{code}</p>
      </main>
    );
  }
}
