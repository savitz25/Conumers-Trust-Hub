import { Shield } from 'lucide-react';
import { AGGREGATE_TRUST_STATS, VERIFICATION_SOURCES } from '@/lib/stats';

export function TrustStats() {
  return (
    <section className="trust-proof py-12 md:py-16">
      <div className="container mx-auto px-4">
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-trust/10 px-4 py-1.5 text-sm font-semibold text-trust border border-trust/20">
            <Shield className="h-4 w-4" aria-hidden="true" />
            VERIFIED ACROSS ALL VERTICALS
          </div>
          <h2 className="section-heading">Trust Signals from the Entire Family</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Aggregated verification data from Move Trust Hub, Lender Trust Hub, and Insurance Trust Hub.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AGGREGATE_TRUST_STATS.map((stat) => (
            <div key={stat.label} className="stat-card">
              <p className="text-3xl font-bold text-trust">{stat.value}</p>
              <p className="mt-1 font-semibold">{stat.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3 md:gap-6">
          {VERIFICATION_SOURCES.map((source) => (
            <span key={source} className="trust-badge trust-badge-verified">
              <Shield className="h-3 w-3" aria-hidden="true" />
              {source}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}