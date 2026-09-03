import { NewJerseyNetworkGateway } from '@/components/new-jersey-network-gateway';
import { JsonLd } from '@/lib/seo/json-ld';
import { BRAND } from '@/lib/brand';
import {
  listNjHubs,
  njReleaseGatePassed,
  NJ_PUBLICATION_MANIFEST,
} from '@/lib/network/nj-network';
import { createPageMetadata } from '@/lib/seo/metadata';

const PATH = '/new-jersey';
const gate = njReleaseGatePassed();

export const metadata = createPageMetadata({
  title: 'New Jersey Consumer Research | The Trust Hub Network',
  description:
    'Explore official evidence across movers, mortgage lenders, insurance, senior care, contractors, and investment advisers in New Jersey. AskTrustHub routes you to specialist research. No paid placements. No Trust Score.',
  path: PATH,
  noIndex: !gate,
});

export default function NewJerseyNetworkPage() {
  const origin = BRAND.url.replace(/\/$/, '');
  const url = `${origin}${PATH}`;
  const hubs = listNjHubs();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'New Jersey Consumer Research | The Trust Hub Network',
        description:
          'Network gateway for New Jersey specialist research. AskTrustHub is not a regulator and does not rank providers.',
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: origin },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'New Jersey', item: url },
        ],
      },
      {
        '@type': 'ItemList',
        name: 'New Jersey specialist research hubs',
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
      <NewJerseyNetworkGateway
        manifest={NJ_PUBLICATION_MANIFEST}
        releaseGatePassed={gate}
      />
    </>
  );
}
