import Link from 'next/link';
import { LastReviewed } from '@/components/last-reviewed';
import { PageHeader } from '@/components/page-header';
import { HubCard } from '@/components/hub-card';
import { createPageMetadata } from '@/lib/seo/metadata';
import { BRAND } from '@/lib/brand';
import { TRUST_HUBS } from '@/lib/hubs';
import {
  ASK_NETWORK_OWNERSHIP_LINE,
  ASK_NETWORK_OWNERSHIP_SHORT,
} from '@/lib/network/standard-version';
import { TRUST_PAGE_REVIEWED } from '@/lib/trust-reviewed';

export const metadata = createPageMetadata({
  title: 'About the Network',
  description:
    'Ask Trust Hub is the parent research network for Move, Insurance, and Lender Trust Hub — common ownership, separated research and listing order, no paid placements.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <>
      <PageHeader
        label="About the network"
        title="Structure and purpose"
        description={`${BRAND.name} is the parent brand and standards layer for a network of specialist consumer research sites.`}
      />

      <div className="container-page py-14 sm:py-16">
        <div className="mb-8">
          <LastReviewed date={TRUST_PAGE_REVIEWED.about} />
          <p className="mt-2 text-sm font-medium text-foreground/80">
            {ASK_NETWORK_OWNERSHIP_SHORT}
          </p>
        </div>
        <div className="prose-trust">
          <p>
            Moving, insurance, and lending are high-stakes markets. They are also crowded with
            comparison products that sell ranking position, bury primary licensing data, and present
            commercial placement as independent research.
          </p>
          <p>
            {BRAND.name} exists to separate those concerns. {ASK_NETWORK_OWNERSHIP_LINE} The parent
            site documents independence policy, verification methodology, data sources, editorial
            standards, and revenue disclosure. Specialist Trust Hubs host market depth—directories,
            tools, and vertical research—under the same constraints.
          </p>

          <h2>Division of responsibility</h2>
          <ul>
            <li>
              <strong>Parent domain (Ask):</strong> network standards, methodology, accountability,
              and discovery — not a provider directory
            </li>
            <li>
              <strong>Specialist domains:</strong> market-specific research products and provider
              directories (Move, Insurance, Lender)
            </li>
          </ul>

          <h2>What this site does not do</h2>
          <ul>
            <li>Operate provider directories</li>
            <li>Host location or vertical tool pages that compete with specialist hubs</li>
            <li>Sell ranking position or undisclosed endorsements</li>
            <li>Originate loans, sell insurance, or book moves</li>
          </ul>

          <p>
            If depth and independence conflict, independence wins. Specialist sites implement market
            research; this site defines the rules under which that research is allowed to claim
            trustworthiness.
          </p>

          <h2>Accountability map</h2>
          <ul>
            <li>
              <Link href="/who-we-are">Who we are</Link> — operator identity and clear answers
            </li>
            <li>
              <Link href="/how-we-make-money">How we make money</Link> — revenue honesty
            </li>
            <li>
              <Link href="/promise">Independence policy</Link> — ranking not for sale
            </li>
            <li>
              <Link href="/corrections">Corrections</Link> — how errors are fixed
            </li>
            <li>
              <Link href="/contact">Contact</Link> — how to reach the organization
            </li>
          </ul>
        </div>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Network destinations
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            External product domains. Links leave asktrusthub.com.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {TRUST_HUBS.map((hub) => (
              <HubCard key={hub.id} hub={hub} />
            ))}
          </div>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/who-we-are" className="btn-primary">
            Who we are
          </Link>
          <Link href="/promise" className="btn-secondary">
            Independence policy
          </Link>
          <Link href="/methodology" className="btn-secondary">
            Methodology
          </Link>
        </div>
      </div>
    </>
  );
}
