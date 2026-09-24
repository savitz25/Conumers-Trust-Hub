import { GeorgiaNetworkGateway } from '@/components/georgia-network-gateway';
import { JsonLd } from '@/lib/seo/json-ld';
import { BRAND } from '@/lib/brand';
import { listGaHubs, gaReleaseGatePassed, GA_PUBLICATION_MANIFEST } from '@/lib/network/ga-network';
import { createPageMetadata } from '@/lib/seo/metadata';

const PATH = '/georgia';
const gate = gaReleaseGatePassed();

export const metadata = createPageMetadata({
  title: 'Georgia Trust Hub Research | The Trust Hub Network',
  description:
    'Explore official evidence across movers, contractors, mortgage lenders, insurance, senior care, and investment professionals in Georgia. AskTrustHub routes you to specialist research. No paid placements. No Trust Score.',
  path: PATH,
  noIndex: !gate,
});

export default function GeorgiaNetworkPage() {
  const origin = BRAND.url.replace(/\/$/, '');
  const url = `${origin}${PATH}`;
  const hubs = listGaHubs();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Georgia Trust Hub Research | The Trust Hub Network',
        description: 'Network gateway for Georgia specialist research. AskTrustHub is not a regulator and does not rank providers.',
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: origin },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Georgia', item: url },
        ],
      },
      {
        '@type': 'Dataset',
        name: 'Georgia Trust Hub Network research catalog',
        description:
          'Catalog of specialist-owned Georgia evidence layers. AskTrustHub is not publishing one combined Georgia record count.',
        url,
        isAccessibleForFree: true,
        creator: { '@type': 'Organization', name: BRAND.name, url: origin },
      },
      {
        '@type': 'ItemList',
        name: 'Georgia specialist research hubs',
        itemListElement: hubs.map((h, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: h.hub_name,
          url: h.canonical_state_url,
        })),
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <GeorgiaNetworkGateway manifest={GA_PUBLICATION_MANIFEST} releaseGatePassed={gate} />
    </>
  );
}
