import { ServicePageLayout } from '@/components/service-page-layout';
import { JsonLd } from '@/lib/seo/json-ld';
import { createPageMetadata } from '@/lib/seo/metadata';
import { SISTER_SITES } from '@/lib/sites';

const PAGE_DESCRIPTION =
  'Discover honest lenders in your county. NMLS verification, CFPB complaints, BBB ratings, and mortgage calculators via Lender Trust Hub.';

export const metadata = createPageMetadata({
  title: 'Mortgage Lenders — NMLS Verified County Insights',
  description: PAGE_DESCRIPTION,
  path: '/lending',
});

const site = SISTER_SITES.lending;

const hubTools = [
  {
    title: 'Local Lender Directory',
    description: '12,450+ verified lenders ranked by county experience and trust scores.',
    href: `${site.url}/local-lenders`,
    external: true,
  },
  {
    title: 'Mortgage Calculators',
    description: 'Payment, affordability, refinance, and amortization tools.',
    href: `${site.url}/calculators`,
    external: true,
  },
  {
    title: 'County Insights',
    description: 'County-specific lender experience scores across 3,142 counties.',
    href: `${site.url}/local-lenders`,
    external: true,
  },
  {
    title: 'Compare Lenders',
    description: 'Side-by-side NMLS, complaint, and closing timeline comparison.',
    href: `${site.url}`,
    external: true,
  },
];

export default function LendingPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Mortgage Lenders Hub',
          description: PAGE_DESCRIPTION,
          url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.consumerstrusthub.com'}/lending`,
        }}
      />
      <ServicePageLayout site={site} hubTools={hubTools} />
    </>
  );
}