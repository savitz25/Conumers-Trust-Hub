import { CaliforniaNetworkGateway } from '@/components/california-network-gateway';
import { JsonLd } from '@/lib/seo/json-ld';
import { BRAND } from '@/lib/brand';
import {
  listCaHubs,
  caReleaseGatePassed,
  CA_PUBLICATION_MANIFEST,
} from '@/lib/network/ca-network';
import { createPageMetadata } from '@/lib/seo/metadata';

const PATH = '/california';
const gate = caReleaseGatePassed();

export const metadata = createPageMetadata({
  title: 'California Consumer Research | The Trust Hub Network',
  description:
    'Explore official evidence across movers, mortgage lenders, insurance, senior care, contractors, and investment advisers in California. AskTrustHub routes you to specialist research. No paid placements. No Trust Score.',
  path: PATH,
  noIndex: !gate,
});

export default function CaliforniaNetworkPage() {
  const origin = BRAND.url.replace(/\/$/, '');
  const url = `${origin}${PATH}`;
  const hubs = listCaHubs();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'California Consumer Research | The Trust Hub Network',
        description:
          'Network gateway for California specialist research. AskTrustHub is not a regulator and does not rank providers.',
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: origin },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'California', item: url },
        ],
      },
      {
        '@type': 'ItemList',
        name: 'California specialist research hubs',
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
      <CaliforniaNetworkGateway
        manifest={CA_PUBLICATION_MANIFEST}
        releaseGatePassed={gate}
      />
    </>
  );
}
