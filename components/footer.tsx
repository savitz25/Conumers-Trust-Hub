import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { BRAND } from '@/lib/brand';
import { HUB_SITES } from '@/lib/sites';

export function Footer() {
  return (
    <footer className="border-t bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="mb-4 brightness-0 invert opacity-95">
              <BrandLogo />
            </div>
            <p className="max-w-md text-sm leading-relaxed text-primary-foreground/75">
              {BRAND.tagline} Independent, verified directories for moving, lending, and
              insurance — with a relocation coach that actually cares.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-widest">Hubs</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/75">
              {Object.values(HUB_SITES).map((hub) => (
                <li key={hub.id}>
                  <Link href={hub.path} className="hover:text-white transition-colors">
                    {hub.subBrand}
                  </Link>
                </li>
              ))}
              <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
              <li><Link href="/concierge" className="hover:text-white transition-colors">AI Concierge</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-widest">Legal</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/75">
              <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
              <li><Link href="/trust" className="hover:text-white transition-colors">Trust</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
        </div>

        <p className="mt-10 text-xs text-primary-foreground/50 leading-relaxed">
          {BRAND.name} is an independent informational platform. Not affiliated with listed
          providers. Verify FMCSA, NMLS, and state DOI records independently.
        </p>
        <p className="mt-4 text-center text-xs text-primary-foreground/40">
          © {new Date().getFullYear()} {BRAND.name} — {BRAND.coachTagline}
        </p>
      </div>
    </footer>
  );
}