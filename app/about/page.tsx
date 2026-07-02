import Link from 'next/link';
import { Shield, ExternalLink } from 'lucide-react';
import { createPageMetadata } from '@/lib/seo/metadata';
import { BRAND } from '@/lib/brand';
import { HUB_SITES } from '@/lib/sites';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = createPageMetadata({
  title: 'About Consumers Trust Hub',
  description:
    'The family story behind Consumers Trust Hub — an independent umbrella connecting Move, Lender, and Insurance Trust Hub directories.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-12 md:py-16">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight">About Consumers Trust Hub</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {BRAND.tagline}
        </p>
      </div>

      <section className="mt-12 max-w-3xl space-y-6 text-foreground/90 leading-relaxed">
        <p>
          Consumers Trust Hub is the central umbrella brand for a family of independent,
          data-driven consumer directories. We built three specialized sites — each fully
          operational on its own — and united them under one trusted starting point so families
          can research moving, lending, and insurance without scattered tabs and conflicting advice.
        </p>
        <p>
          We are not affiliated with, endorsed by, or partners of the companies listed on our
          sister sites. Company names, logos, and data are used for identification and research
          purposes only. Every directory maintains a strict zero paid placements policy.
        </p>
        <p>
          Our verification standards draw from authoritative public sources: FMCSA for movers,
          NMLS and CFPB for lenders, and state Departments of Insurance for agents. We combine
          these with attributed reviews and transparent trust scores — never sponsored rankings.
        </p>
      </section>

      <section className="mt-16">
        <h2 className="section-heading">The Trust Hub Family</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(HUB_SITES).map((site) => (
            <Card key={site.id}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-trust" />
                  <h3 className="font-semibold">{site.name}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{site.tagline}</p>
                <Button variant="link" className="mt-3 h-auto p-0 gap-1" asChild>
                  <Link href={site.path}>
                    Explore {site.subBrand} <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="mt-12">
        <Button variant="trust" asChild>
          <Link href="/trust">Read Our Independence Pledge</Link>
        </Button>
      </div>
    </div>
  );
}