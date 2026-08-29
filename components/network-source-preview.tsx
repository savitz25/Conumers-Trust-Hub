import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { getTrustHubNetworkState } from '@/lib/network/aggregator';
import { previewSourceOrganizations } from '@/lib/network/source-registry';

export function NetworkSourcePreview() {
  const state = getTrustHubNetworkState();
  const orgs = previewSourceOrganizations(8);

  return (
    <section
      id="inspect-evidence"
      aria-labelledby="inspect-evidence-heading"
      className="section-block scroll-mt-24 border-b"
      style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.white }}
    >
      <div className="container-page">
        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
          Inspect the evidence behind the network
        </p>
        <h2
          id="inspect-evidence-heading"
          className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
          style={{ color: ASK_BRAND.navy }}
        >
          Research spanning {state.sourceFamilyCount} public-source families from{' '}
          {state.sourceOrganizationCount} source organizations
        </h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          {state.regulatorCount} regulators/agencies are classified separately — not every source
          organization is an agency. Latest official as-of {state.latestOfficialAsOf}. Retrieved{' '}
          {state.latestRetrievedAt}. Six hubs represented.
        </p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {orgs.map((org) => (
            <li
              key={org}
              className="rounded-full border bg-white px-3 py-2 text-sm"
              style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy, boxShadow: ASK_SHADOW.soft }}
            >
              {org}
            </li>
          ))}
        </ul>
        <Link
          href="/data-sources"
          className="mt-6 inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold text-white"
          style={{ backgroundColor: ASK_BRAND.indigo }}
        >
          View the full source ledger
        </Link>
      </div>
    </section>
  );
}
