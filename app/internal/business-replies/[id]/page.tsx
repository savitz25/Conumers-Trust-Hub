import { createPageMetadata } from "@/lib/seo/metadata";
import { readSessionToken, withPlatform } from "@/lib/customer/server";
import { responseModerationWarnings } from "@/lib/customer/claim-governance";
import { ReviewActions } from "./ReviewActions";
export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "Review business response",
  description: "Staff-only moderation.",
  path: "/internal/business-replies",
  noIndex: true,
});
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    token = await readSessionToken();
  try {
    const d = await withPlatform((p) =>
        p.getBusinessReplyReview(token || "", id),
      ),
      r = d.reply,
      warnings = responseModerationWarnings(String(r.body));
    return (
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-12">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo">
            Layer D &middot; staff moderation
          </p>
          <h1 className="text-2xl font-semibold">Business response</h1>
        </header>
        <dl className="card-surface grid gap-3 p-5 text-sm">
          <div>
            <dt>Profile</dt>
            <dd>
              {String(r.display_name_snapshot)} &middot;{" "}
              {String(r.native_credential_key)}
            </dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>
              {String(r.target_type)} &middot;{" "}
              {String(r.target_record_id || "profile")}
            </dd>
          </div>
          <div>
            <dt>Proposed response</dt>
            <dd className="whitespace-pre-wrap">{String(r.body)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              {String(r.status)} &middot; version {String(r.version)}
            </dd>
          </div>
        </dl>
        <aside className="rounded border border-amber-200 bg-amber-50 p-4 text-sm">
          <strong>Human policy check required.</strong> Reject or redact
          private-person identifiers, contact/health/financial data, threats,
          harassment, unsupported accusations, secrets, and unsupported external
          links. Approval permits publication only; it is not factual
          verification or Trust Hub endorsement.
          {warnings.length ? (
            <span className="mt-2 block font-semibold">
              Deterministic warnings: {warnings.join(", ")}. Warnings never
              replace human review.
            </span>
          ) : null}
        </aside>
        <section>
          <h2 className="font-semibold">Moderation history</h2>
          <ul>
            {d.events.map((e, i) => (
              <li className="text-sm" key={i}>
                {String(e.event_type)} &middot; {String(e.visibility)} &middot;{" "}
                {String(e.message || "")}
              </li>
            ))}
          </ul>
        </section>
        <ReviewActions id={id} version={Number(r.version)} />
      </main>
    );
  } catch {
    return <main className="p-12">Unavailable or unauthorized.</main>;
  }
}
