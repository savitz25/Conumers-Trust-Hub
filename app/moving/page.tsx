import { ServicePageLayout } from '@/components/service-page-layout';
import { JsonLd } from '@/lib/seo/json-ld';
import { createPageMetadata } from '@/lib/seo/metadata';
import { SISTER_SITES } from '@/lib/sites';

const PAGE_DESCRIPTION =
  'Compare FMCSA-licensed interstate movers with verified reviews. Free quotes, moving calculator, and side-by-side comparison via Move Trust Hub.';

export const metadata = createPageMetadata({
  title: 'Moving Companies — FMCSA Verified Movers',
  description: PAGE_DESCRIPTION,
  path: '/moving',
});

const site = SISTER_SITES.moving;

const hubTools = [
  {
    title: 'Mover Directory',
    description: 'Browse 25+ FMCSA-licensed interstate movers with reputation scores.',
    href: `${site.url}/companies`,
    external: true,
  },
  {
    title: 'Moving Calculator',
    description: 'Estimate cubic feet, weight, and truck size before requesting quotes.',
    href: `${site.url}/moving-calculator`,
    external: true,
  },
  {
    title: 'Side-by-Side Compare',
    description: 'Compare up to 4 movers on licensing, pricing, and reviews.',
    href: `${site.url}/compare`,
    external: true,
  },
  {
    title: 'DOT Number Verification',
    description: 'Look up any carrier USDOT/MC number against FMCSA SAFER.',
    href: `${site.url}/verify-dot`,
    external: true,
  },
];

export default function MovingPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Moving Companies Hub',
          description: PAGE_DESCRIPTION,
          url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.consumerstrusthub.com'}/moving`,
        }}
      />
      <ServicePageLayout site={site} hubTools={hubTools} />
    </>
  );
}