import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { BRAND } from '@/lib/brand';
import {
  ASK_FOOTER_COLUMNS,
  ASK_INDEPENDENCE_LINE,
  ASK_NETWORK_LINKS,
} from '@/lib/design/ask-design-system';
import { ASK_NETWORK_OWNERSHIP_SHORT } from '@/lib/network/standard-version';
import { caReleaseGatePassed } from '@/lib/network/ca-network';
import { txReleaseGatePassed } from '@/lib/network/tx-network';
import { waReleaseGatePassed } from '@/lib/network/wa-network';
import { azReleaseGatePassed } from '@/lib/network/az-network';

/**
 * Ask Trust Hub footer — Phase 1.
 * Deep navy · light logo · network hubs · independence · legal.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-[#0A2540] text-slate-200">
      <div className="container-page py-12 sm:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-4">
            <BrandLogo inverted />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-300">
              Knowledge &amp; concierge layer for the Trust Hub network. Situation routing,
              the Standard, and independence policy — not a provider marketplace.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-400 max-w-sm">
              {ASK_NETWORK_OWNERSHIP_SHORT}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400 max-w-sm">
              {ASK_INDEPENDENCE_LINE}
            </p>
            <p className="mt-4 text-sm">
              <a
                href={`mailto:${BRAND.email}`}
                className="font-medium text-[#E0E7FF] underline-offset-2 hover:text-white hover:underline"
              >
                {BRAND.email}
              </a>
            </p>
          </div>

          {/* Network hubs */}
          <div className="lg:col-span-2">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Network
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-300">
              {ASK_NETWORK_LINKS.map((hub) => (
                <li key={hub.id}>
                  <a
                    href={hub.href}
                    className="transition-colors hover:text-white"
                    rel="noopener noreferrer"
                  >
                    {hub.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  href="/promise"
                  className="font-medium text-[#E0E7FF] transition-colors hover:text-white"
                >
                  Independence Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Columns */}
          {ASK_FOOTER_COLUMNS.map((col) => (
            <div key={col.title} className="lg:col-span-2">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                {col.title}
              </h4>
              <ul className="space-y-2.5 text-sm text-slate-300">
                {col.links
                  .filter(
                    (item) =>
                      (item.href !== '/california' || caReleaseGatePassed()) &&
                      (item.href !== '/texas' || txReleaseGatePassed()) &&
                      (item.href !== '/washington' || waReleaseGatePassed()) &&
                      (item.href !== '/arizona' || azReleaseGatePassed()),
                  )
                  .map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="transition-colors hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <p className="max-w-3xl text-xs leading-relaxed text-slate-400">
            {BRAND.name} is an informational research network under common ownership with our
            specialist hubs — with separated research and listing order and no paid placements. Not
            endorsed by or a partner of listed providers. Confirm licensing and terms with primary
            regulators and the company before contractual commitment. Specialist directories and
            tools live on the specialist hubs — not on this parent site.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">
              © {year} {BRAND.name}. {BRAND.tagline}
            </p>
            <p className="text-xs font-medium text-slate-400">
              {ASK_NETWORK_OWNERSHIP_SHORT}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
