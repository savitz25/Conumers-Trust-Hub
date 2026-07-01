import { ServicePageLayout } from '@/components/service-page-layout';
import { JsonLd } from '@/lib/seo/json-ld';
import { createPageMetadata } from '@/lib/seo/metadata';
import { SISTER_SITES } from '@/lib/sites';

const PAGE_DESCRIPTION =
  'Compare state-licensed insurance agents with DOI verification, health hubs, and premium calculators via Insurance Trust Hub.';

export const metadata = createPageMetadata({
  title: 'Insurance Agents — DOI Verified Directory',
  description: PAGE_DESCRIPTION,
  path: '/insurance',
});

const site = SISTER_SITES.insurance;

const hubTools = [
  {
    title: 'Agent Directory',
    description: 'Browse verified agents and agencies across all 50 states.',
    href: `${site.url}/directory`,
    external: true,
  },
  {
    title: 'Health Insurance Hubs',
    description: '54 market hubs with ACA, Medicare, and employer plan specialists.',
    href: `${site.url}/hubs`,
    external: true,
  },
  {
    title: 'Premium Calculators',
    description: 'ACA subsidy, Medicare gap, and premium estimator tools.',
    href: `${site.url}/calculators`,
    external: true,
  },
  {
    title: 'License Verification',
    description: 'Verify agent licensing against state DOI public records.',
    href: `${site.url}/tools/license-verification`,
    external: true,
  },
];

export default function InsurancePage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Insurance Agents Hub',
          description: PAGE_DESCRIPTION,
          url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.consumerstrusthub.com'}/insurance`,
        }}
      />
      <ServicePageLayout site={site} hubTools={hubTools} />
    </>
  );
}