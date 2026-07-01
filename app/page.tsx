import Link from 'next/link';
import { Shield, ArrowRight, BookOpen } from 'lucide-react';
import { UnifiedSearch } from '@/components/unified-search';
import { ServiceCard } from '@/components/service-card';
import { TrustStats } from '@/components/trust-stats';
import { HowItWorks } from '@/components/how-it-works';
import { TestimonialsCarousel } from '@/components/testimonials-carousel';
import { CtaSection } from '@/components/cta-section';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildHomepageGraph } from '@/lib/seo/schemas';
import { SISTER_SITES } from '@/lib/sites';
import { ARTICLES } from '@/lib/resources/articles';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function HomePage() {
  const featuredArticles = ARTICLES.filter((a) => a.category === 'cross-category').slice(0, 3);

  return (
    <>
      <JsonLd data={buildHomepageGraph()} />

      <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/5 via-background to-trust/5">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-trust/20 bg-trust/10 px-4 py-1.5 text-sm font-semibold text-trust">
              <Shield className="h-4 w-4" aria-hidden="true" />
              FMCSA · NMLS · DOI VERIFIED · ZERO PAID PLACEMENTS
            </div>

            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-foreground md:text-5xl lg:text-6xl">
              One Trusted Hub for Moving, Lending & Insurance
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Discover, compare, and shop with confidence. Three specialized directories —
              one convenient starting point.
            </p>

            <div className="mx-auto mt-10 max-w-lg">
              <UnifiedSearch />
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Shop with Confidence · Independent · Data-Driven · Location-Based
            </p>
          </div>
        </div>
      </section>

      <TrustStats />

      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mb-10 text-center">
            <h2 className="section-heading">Explore Our Verified Directories</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Each sister site remains fully operational. Start here or dive deep into any vertical.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {Object.values(SISTER_SITES).map((site, index) => (
              <ServiceCard key={site.id} site={site} index={index} />
            ))}
          </div>
        </div>
      </section>

      <HowItWorks />

      <section className="border-y bg-muted/30 py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mb-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="section-heading">Complete Move Package Guides</h2>
              <p className="mt-2 max-w-xl text-muted-foreground">
                Cross-category resources connecting moving, mortgage, and insurance decisions.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/resources" className="gap-2">
                All Resources <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredArticles.map((article) => (
              <Link key={article.slug} href={`/resources/${article.slug}`}>
                <Card className="h-full transition-shadow hover:shadow-trust-lg">
                  <CardContent className="pt-6">
                    <Badge variant="trust" className="mb-3">Cross-Category</Badge>
                    <h3 className="font-semibold text-lg leading-snug">{article.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{article.excerpt}</p>
                    <p className="mt-3 flex items-center gap-1 text-xs font-medium text-trust">
                      <BookOpen className="h-3.5 w-3.5" />
                      {article.readTime} read
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <TestimonialsCarousel />
      <CtaSection />
    </>
  );
}