import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { BRAND } from '@/lib/brand';
import { TRUST_HUBS } from '@/lib/hubs';
import { FOOTER_ABOUT, FOOTER_LEGAL } from '@/lib/content';

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-navy text-navy-foreground">
      <div className="container-page py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <BrandLogo inverted />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">
              Independent consumer research network. Trust infrastructure and discovery for
              moving, insurance, and lending.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
              The Trust Hubs
            </h4>
            <ul className="space-y-2.5 text-sm text-white/70">
              {TRUST_HUBS.map((hub) => (
                <li key={hub.id}>
                  {hub.status === 'live' ? (
                    <a
                      href={hub.url}
                      className="transition-colors hover:text-white"
                      rel="noopener noreferrer"
                    >
                      {hub.name}
                    </a>
                  ) : (
                    <span className="flex items-center gap-2">
                      {hub.name}
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">
                        Soon
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
              Network
            </h4>
            <ul className="space-y-2.5 text-sm text-white/70">
              {FOOTER_ABOUT.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition-colors hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
              Methodology & Legal
            </h4>
            <ul className="space-y-2.5 text-sm text-white/70">
              {FOOTER_LEGAL.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition-colors hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <p className="max-w-3xl text-xs leading-relaxed text-white/45">
            {BRAND.name} is an independent informational network. Not affiliated with, endorsed by,
            or a partner of listed providers. Always verify licensing and terms with primary
            regulators (FMCSA, state DOI, NMLS) and the company before you commit.
          </p>
          <p className="mt-4 text-xs text-white/35">
            © {new Date().getFullYear()} {BRAND.name}. {BRAND.tagline}
          </p>
        </div>
      </div>
    </footer>
  );
}
