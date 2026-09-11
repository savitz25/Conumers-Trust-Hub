import { NewYorkNetworkGateway } from '@/components/new-york-network-gateway';
import { JsonLd } from '@/lib/seo/json-ld';
import { BRAND } from '@/lib/brand';
import {
  listNyHubs,
  nyReleaseGatePassed,
  NY_PUBLICATION_MANIFEST,
} from '@/lib/network/ny-network';
import { createPageMetadata } from '@/lib/seo/metadata';

const PATH = '/new-york';
const gate = nyReleaseGatePassed();

export const metadata = createPageMetadata({
  title: 'New York Consumer Research | The Trust Hub Network',
  description:
    'Explore official evidence across contractors, movers, senior care, mortgage lenders, insurance, and investment advisers in New York. AskTrustHub routes you to specialist research. No paid placements. No Trust Score.',
  path: PATH,
  noIndex: !gate,
});

export default function NewYorkNetworkPage() {
  const origin = BRAND.url.replace(/\/$/, '');
  const url = `${origin}${PATH}`;
  const hubs = listNyHubs();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'New York Consumer Research | The Trust Hub Network',
        description:
          'Network gateway for New York specialist research. AskTrustHub is not a regulator and does not rank providers.',
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: origin },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'New York', item: url },
        ],
      },
      {
        '@type': 'Organization',
        name: BRAND.name,
        url: origin,
      },
      {
        '@type': 'Dataset',
        name: 'New York Trust Hub Network research catalog',
        description:
          'Catalog of specialist-owned New York evidence layers. Not a ranking and not a combined record count.',
        url,
        isAccessibleForFree: true,
        creator: { '@type': 'Organization', name: BRAND.name, url: origin },
      },
      {
        '@type': 'ItemList',
        name: 'New York specialist research hubs',
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
      <NewYorkNetworkGateway
        manifest={NY_PUBLICATION_MANIFEST}
        releaseGatePassed={gate}
      />
    </>
  );
}
