import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildArticleSchema, buildBreadcrumbSchema } from '@/lib/seo/schemas';
import { ARTICLES, getArticleBySlug } from '@/lib/resources/articles';
import { BRAND } from '@/lib/brand';
import { HUB_SITES } from '@/lib/sites';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};

  return createPageMetadata({
    title: article.title,
    description: article.excerpt,
    path: `/resources/${article.slug}`,
  });
}

const ARTICLE_CONTENT: Record<string, string[]> = {
  'how-a-move-affects-your-mortgage-and-insurance': [
    'Relocating triggers a cascade of financial decisions. Your mortgage escrow may need updating, homeowners insurance must be re-quoted for the new address, and health coverage may qualify for a special enrollment period.',
    'Start by notifying your lender of your move date. Escrow accounts for property taxes and insurance are tied to your property address — a gap in coverage during transition can delay closing on a purchase or create compliance issues on a refinance.',
    'For insurance, request quotes 30–45 days before your move. Homeowners policies vary significantly by ZIP code, and health insurance markets differ by county. Use DOI-verified agents to compare options in your destination market.',
    'Coordinate your moving timeline with loan contingencies. If you are purchasing, ensure your movers are FMCSA-licensed and that your lender has clear-to-close before scheduling delivery.',
  ],
  'complete-move-package-checklist': [
    'Week 12–8: Get pre-approved with an NMLS-verified lender. Run affordability calculators and identify target counties.',
    'Week 8–6: Request moving quotes from FMCSA-licensed carriers. Use the moving calculator to estimate cubic footage.',
    'Week 6–4: Shop homeowners and renters insurance for the new address. Explore health insurance if changing states.',
    'Week 4–2: Finalize mover selection, confirm closing date with lender, and bind insurance effective on move-in day.',
    'Week 2–0: Change address with USPS, update auto insurance, and verify all licenses (mover DOT, lender NMLS, agent DOI).',
  ],
  'verify-mover-before-booking': [
    'Every interstate mover must have an active USDOT number registered with FMCSA. Search the SAFER system and confirm operating authority status.',
    'Check complaint ratios relative to fleet size. A high volume of unresolved complaints is a red flag regardless of marketing claims.',
    'Compare attributed reviews — named reviewers with specific move details are more reliable than anonymous testimonials on company websites.',
    'Never pay large deposits upfront. Reputable carriers typically collect payment at delivery, not weeks before pickup.',
  ],
  'county-lender-comparison-guide': [
    'NMLS licensing confirms a lender or broker is authorized to originate loans. Verify the NMLS ID matches the entity you are speaking with.',
    'County experience scores reflect how actively a lender closes loans in your specific county — critical for local appraisal knowledge and closing timelines.',
    'CFPB complaint data reveals patterns. A few complaints among thousands of loans is normal; clusters about the same issue are not.',
    'Compare average close times, especially if you have a purchase contract deadline. County-level data surfaces lenders who consistently hit timelines.',
  ],
  'health-insurance-after-relocation': [
    'Moving to a new state almost always triggers a Special Enrollment Period for ACA marketplace coverage. You typically have 60 days from your move date to enroll.',
    'Medicare beneficiaries should compare plan networks in the new area. Original Medicare travels with you, but Medicare Advantage and Part D plans are location-specific.',
    'Employer-sponsored coverage may change if your employer operates in a different state. Coordinate with HR before giving notice.',
    'Work with DOI-verified agents who specialize in your destination market — licensing and plan availability vary significantly by state.',
  ],
  'first-time-homebuyer-triad': [
    'Pre-approval is step one. An NMLS-verified lender will review your credit, income, and debt to set a realistic budget before you house-hunt.',
    'Homeowners insurance is required at closing. Get quotes early — premiums affect your debt-to-income ratio when escrow is included in the payment.',
    'Plan your move before closing. Book FMCSA-licensed movers once you have a firm closing date, and align utility transfers and address changes.',
    'Keep all three providers in the loop. A delay in insurance binding or a mover no-show can jeopardize your closing timeline.',
  ],
};

export default async function ResourceArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? BRAND.url;
  const paragraphs = ARTICLE_CONTENT[slug] ?? [article.excerpt];

  return (
    <article className="container mx-auto px-4 py-12 md:py-16">
      <JsonLd data={buildArticleSchema(slug)} />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: siteUrl },
          { name: 'Resources', url: `${siteUrl}/resources` },
          { name: article.title, url: `${siteUrl}/resources/${slug}` },
        ])}
      />

      <Link
        href="/resources"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Resources
      </Link>

      <header className="mt-6 max-w-3xl">
        <Badge variant="trust" className="mb-4">{article.category}</Badge>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{article.title}</h1>
        <p className="mt-4 text-muted-foreground">{article.excerpt}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {article.readTime} · Published {article.publishedAt}
        </p>
      </header>

      <div className="prose prose-slate mt-10 max-w-3xl dark:prose-invert">
        {paragraphs.map((paragraph, i) => (
          <p key={i} className="mb-4 leading-relaxed text-foreground/90">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="mt-12 max-w-3xl rounded-xl border bg-muted/30 p-6">
        <h2 className="font-semibold">Related Trust Hub Sites</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Continue your research on our specialized directories:
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {article.relatedSites.map((vertical) => {
            const site = HUB_SITES[vertical];
            return (
              <Button key={vertical} variant="outline" size="sm" asChild>
                <Link href={site.path} className="gap-1">
                  {site.subBrand} <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            );
          })}
        </div>
      </div>
    </article>
  );
}