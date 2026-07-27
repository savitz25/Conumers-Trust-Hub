import Link from 'next/link';
import { ArrowRight, ShieldCheck, Scale, Eye, ArrowUpRight } from 'lucide-react';
import { HubCard } from '@/components/hub-card';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildHomepageGraph } from '@/lib/seo/schemas';
import { BRAND } from '@/lib/brand';
import { TRUST_HUBS } from '@/lib/hubs';
import { INDEPENDENCE_PLEDGES } from '@/lib/content';

export default function HomePage() {
  return (
    <>
      <JsonLd data={buildHomepageGraph()} />

      {/* Hero — parent network, not product surface */}
      <section className="relative overflow-hidden border-b border-border/70">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgb(13_148_136/0.07),_transparent_55%)]" />
        <div className="container-page relative py-20 sm:py-28 lg:py-32">
          <div className="max-w-3xl">
            <p className="section-label">Independent consumer research network</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
              Independent verification. Transparent research. Zero paid placements.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {BRAND.name} is the <strong className="font-semibold text-foreground">trust infrastructure
              and discovery layer</strong> behind MoveTrustHub, InsuranceTrustHub, and
              LenderTrustHub. This parent site explains how the network stays independent.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Directories, tools, and market depth live on the specialist Trust Hubs—not here.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#trust-hubs" className="btn-primary">
                Explore the Trust Network
              </a>
              <Link href="/promise" className="btn-secondary">
                Our independence promise
              </Link>
            </div>
          </div>

          <dl className="mt-16 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: 'Parent network',
                body: 'Standards, methodology, and discovery—not the product surface.',
              },
              {
                icon: Scale,
                title: 'Independent',
                body: 'Not a mover, lender, or insurer. Research infrastructure only.',
              },
              {
                icon: Eye,
                title: 'Transparent',
                body: 'Published process. No paid rankings. Clear revenue disclosure.',
              },
            ].map((item) => (
              <div key={item.title} className="card-surface p-5">
                <dt className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <item.icon className="h-4 w-4 text-trust" aria-hidden />
                  {item.title}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Independence statement */}
      <section className="border-b border-border/70 bg-navy text-navy-foreground">
        <div className="container-page py-14 sm:py-16">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-300/90">
              Independence statement
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              We do not sell trust. We build systems that protect it.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-white/70 sm:text-lg">
              Consumer research is broken when paid placement masquerades as advice. Across every
              Trust Hub, ranking position cannot be purchased, Trust Scores cannot be bought, and
              commercial relationships—if any—are isolated from editorial ordering and clearly
              disclosed.
            </p>
            <Link href="/promise" className="btn-ghost mt-6 text-white hover:text-teal-200">
              Full independence promise <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Explore the Trust Network — external destinations only */}
      <section id="trust-hubs" className="scroll-mt-20 border-b border-border/70">
        <div className="container-page py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="section-label">Explore the Trust Network</p>
            <h2 className="section-title mt-3">
              Specialist destinations. Shared independence standard.
            </h2>
            <p className="section-lead">
              Choose a Trust Hub to research providers. Each site is a separate product destination
              under the same zero paid-placement rules. This parent domain does not host directories
              or vertical tools.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {TRUST_HUBS.map((hub) => (
              <HubCard key={hub.id} hub={hub} />
            ))}
          </div>

          <p className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {TRUST_HUBS.filter((h) => h.status === 'live').map((hub) => (
              <a
                key={hub.id}
                href={hub.url}
                className="inline-flex items-center gap-1 font-medium text-navy hover:text-trust"
                rel="noopener noreferrer"
              >
                {hub.domain}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            ))}
          </p>
        </div>
      </section>

      {/* How we stay independent */}
      <section className="border-b border-border/70 bg-muted/30">
        <div className="container-page py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="section-label">How we stay independent</p>
            <h2 className="section-title mt-3">Four non-negotiables</h2>
            <p className="section-lead">
              Independence is a network requirement, not a marketing line. These rules apply to
              every Trust Hub.
            </p>
          </div>

          <ol className="mt-10 grid gap-5 sm:grid-cols-2">
            {INDEPENDENCE_PLEDGES.map((item, i) => (
              <li key={item.title} className="card-surface p-6">
                <span className="text-xs font-semibold tabular-nums text-trust">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/methodology" className="btn-primary">
              How we verify
            </Link>
            <Link href="/how-we-make-money" className="btn-secondary">
              How we make money
            </Link>
          </div>
        </div>
      </section>

      {/* Closing — infrastructure, not product */}
      <section>
        <div className="container-page py-16 sm:py-20">
          <div className="card-surface flex flex-col gap-6 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Methodology, accountability, and standards—not a relocation app.
              </h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Read who operates the network, how verification works, and how we fund the work
                without selling rankings.
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
