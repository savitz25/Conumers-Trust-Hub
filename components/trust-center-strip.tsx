import Link from 'next/link';
import { TRUST_CENTER_LINKS } from '@/lib/situations';

/**
 * Trust Center owned on Ask — hubs link in; Ask hosts the standards once.
 */
export function TrustCenterStrip() {
  return (
    <section
      id="trust-center"
      aria-labelledby="trust-center-heading"
      className="scroll-mt-20 border-b border-border/80 bg-muted/30"
    >
      <div className="container-page py-14 sm:py-16">
        <div className="max-w-2xl">
          <p className="section-label">Trust Center</p>
          <h2 id="trust-center-heading" className="section-title mt-3">
            Standards for the whole network
          </h2>
          <p className="section-lead">
            Independence, methodology, data sources, and corrections live here on Ask Trust Hub.
            Specialist hubs apply these rules in their markets.
          </p>
        </div>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TRUST_CENTER_LINKS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex h-full flex-col rounded-xl border border-border/80 bg-background p-5 transition-colors hover:border-navy/20 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
              >
                <span className="font-semibold text-foreground">{item.label}</span>
                <span className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {item.detail}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
