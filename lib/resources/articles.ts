export interface ResourceArticle {
  slug: string;
  title: string;
  excerpt: string;
  category: 'moving' | 'lending' | 'insurance' | 'cross-category';
  readTime: string;
  publishedAt: string;
  relatedSites: ('moving' | 'lending' | 'insurance')[];
}

export const ARTICLES: ResourceArticle[] = [
  {
    slug: 'how-a-move-affects-your-mortgage-and-insurance',
    title: 'How a Move Affects Your Mortgage and Insurance',
    excerpt:
      'Relocating impacts more than boxes and trucks. Learn how address changes affect your mortgage escrow, homeowners policy, and health coverage during open enrollment.',
    category: 'cross-category',
    readTime: '8 min',
    publishedAt: '2026-01-15',
    relatedSites: ['moving', 'lending', 'insurance'],
  },
  {
    slug: 'complete-move-package-checklist',
    title: 'The Complete Move Package Checklist',
    excerpt:
      'A step-by-step guide covering FMCSA-verified movers, pre-approval timing, and insurance updates — everything you need for a coordinated relocation.',
    category: 'cross-category',
    readTime: '10 min',
    publishedAt: '2026-02-01',
    relatedSites: ['moving', 'lending', 'insurance'],
  },
  {
    slug: 'verify-mover-before-booking',
    title: 'How to Verify a Mover Before You Book',
    excerpt:
      'Use FMCSA SAFER lookups, complaint ratios, and attributed reviews to avoid moving scams. Includes a printable verification checklist.',
    category: 'moving',
    readTime: '6 min',
    publishedAt: '2026-01-20',
    relatedSites: ['moving'],
  },
  {
    slug: 'county-lender-comparison-guide',
    title: 'County-Level Lender Comparison: What to Look For',
    excerpt:
      'Understand NMLS licensing, county experience scores, CFPB complaints, and closing timelines when comparing local mortgage lenders.',
    category: 'lending',
    readTime: '7 min',
    publishedAt: '2026-01-25',
    relatedSites: ['lending'],
  },
  {
    slug: 'health-insurance-after-relocation',
    title: 'Health Insurance After Relocation: Special Enrollment & New Markets',
    excerpt:
      'Moving triggers special enrollment periods. Compare ACA, Medicare, and employer options with DOI-verified agents in your new market.',
    category: 'insurance',
    readTime: '9 min',
    publishedAt: '2026-02-10',
    relatedSites: ['insurance', 'moving'],
  },
  {
    slug: 'first-time-homebuyer-triad',
    title: 'First-Time Homebuyer Triad: Lender, Insurance & Moving Coordination',
    excerpt:
      'Align your mortgage pre-approval, homeowners insurance quote, and move timeline so closing day goes smoothly.',
    category: 'cross-category',
    readTime: '11 min',
    publishedAt: '2026-02-18',
    relatedSites: ['lending', 'insurance', 'moving'],
  },
];

export function getArticleBySlug(slug: string): ResourceArticle | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}