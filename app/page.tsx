import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { HubCard } from '@/components/hub-card';
import { SituationRouter } from '@/components/situation-router';
import { TrustCenterStrip } from '@/components/trust-center-strip';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildHomepageGraph } from '@/lib/seo/schemas';
import { BRAND } from '@/lib/brand';
import { TRUST_HUBS } from '@/lib/hubs';
import { INDEPENDENCE_PLEDGES } from '@/lib/content';

/**
 * Ask Trust Hub homepage — situation router + Trust Center + hub discovery.
 * No directories or vertical guide farms on this domain.
 */
export default function HomePage() {
  return (
    <>
      <JsonLd data={buildHomepageGraph()} />

      {/* 2.1 Situation router — above the fold */}
      <SituationRouter />

      {/* Compact network framing */}
      <section className="border-b border-border/80 bg-navy text-navy-foreground">
        <div className="container-page py-12 sm:py-14">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
              How Ask works
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              We ask. Then we route. Specialists do the deep research.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-[17px]">
              {BRAND.name} is the discovery and trust layer for Move Trust Hub, Insurance Trust Hub,
              and Lender Trust Hub. Ranking position is not for sale. Directories and tools live on
              the specialist domains — not here.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              <Link
                href="/promise"
                className="inline-flex items-center gap-1.5 font-semibold text-white underline-offset-4 hover:underline"
              >
                Independence policy <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a
                href="#trust-hubs"
                className="inline-flex items-center gap-1.5 font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline"
              >
                Browse the Trust Hubs
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 2.1 Trust Center — owned on Ask */}
      <TrustCenterStrip />

      {/* Specialist discovery */}
      <section id="trust-hubs" className="scroll-mt-20 border-b border-border/80">
        <div className="container-page py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="section-label">The Trust Hubs</p>
            <h2 className="section-title mt-3">Specialist research destinations</h2>
            <p className="section-lead">
              Each hub is a separate product domain under shared network standards. Provider
              research, directories, and tools are hosted on the specialist sites.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {TRUST_HUBS.map((hub) => (
              <HubCard key={hub.id} hub={hub} />
            ))}
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {TRUST_HUBS.filter((h) => h.status === 'live').map((hub) => (
              <li key={hub.id}>
                <a
                  href={hub.url}
                  className="inline-flex items-center gap-1 font-medium text-foreground/80 hover:text-foreground"
                  rel="noopener noreferrer"
                >
                  {hub.domain}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b border-border/80 bg-muted/40">
        <div className="container-page py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="section-label">Network standards</p>
            <h2 className="section-title mt-3">Independence principles</h2>
            <p className="section-lead">
              These requirements apply to every Trust Hub. They are operational constraints, not
              marketing claims.
            </p>
          </div>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2">
            {INDEPENDENCE_PLEDGES.map((item, i) => (
              <li key={item.title} className="border border-border/80 bg-background p-6">
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-2 text-base font-semibold tracking-tight text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/methodology" className="btn-primary">
              Methodology
            </Link>
            <Link href="/how-we-make-money" className="btn-secondary">
              Revenue disclosure
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="container-page py-16 sm:py-20">
          <div className="flex flex-col gap-6 border border-border/80 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div className="max-w-xl">
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Governance, methodology, and accountability
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Documentation of who operates the network, how providers are verified, and how the
                work is funded.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/who-we-are" className="btn-primary">
                Who we are
              </Link>
              <Link href="/contact" className="btn-secondary">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
