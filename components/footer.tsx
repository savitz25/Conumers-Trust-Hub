import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { CONSUMERS_TRUST_HUB, SISTER_SITES } from '@/lib/sites';

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="mb-4 brightness-0 invert">
              <BrandLogo />
            </div>
            <p className="max-w-md text-sm leading-relaxed text-primary-foreground/80">
              The central umbrella brand for the Consumers Trust Hub family. Independent,
              data-driven directories for moving, lending, and insurance — zero paid placements,
              multi-source verification.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider">Trust Hub Family</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li>
                <Link href="/" className="transition-colors hover:text-white">
                  Consumers Trust Hub
                </Link>
              </li>
              {Object.values(SISTER_SITES).map((site) => (
                <li key={site.id}>
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-white"
                  >
                    {site.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider">Legal & Info</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li><Link href="/about" className="transition-colors hover:text-white">About</Link></li>
              <li><Link href="/trust" className="transition-colors hover:text-white">Trust & Verification</Link></li>
              <li><Link href="/resources" className="transition-colors hover:text-white">Resources</Link></li>
              <li><Link href="/contact" className="transition-colors hover:text-white">Contact</Link></li>
              <li><Link href="/privacy" className="transition-colors hover:text-white">Privacy Policy</Link></li>
              <li><Link href="/terms" className="transition-colors hover:text-white">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-primary-foreground/60">
          Consumers Trust Hub is an independent informational platform. We are not affiliated with,
          endorsed by, or a partner of the moving companies, lenders, or insurance agents listed on
          our sister sites. Data is for research and comparison purposes only. Always verify
          licensing directly with FMCSA, NMLS, or your state Department of Insurance.
        </p>

        <div className="mt-6 border-t border-white/10 pt-6 text-center text-xs text-primary-foreground/50">
          © {new Date().getFullYear()} {CONSUMERS_TRUST_HUB.name} — One Trusted Hub for Moving, Lending & Insurance
        </div>
      </div>
    </footer>
  );
}