import { ArizonaNetworkGateway } from '@/components/arizona-network-gateway';
import { JsonLd } from '@/lib/seo/json-ld';
import { BRAND } from '@/lib/brand';
import {
  listAzHubs,
  azReleaseGatePassed,
  AZ_PUBLICATION_MANIFEST,
} from '@/lib/network/az-network';
import { createPageMetadata } from '@/lib/seo/metadata';

const PATH = '/arizona';
const gate = azReleaseGatePassed();

export const metadata = createPageMetadata({
  title: 'Arizona Consumer Research | The Trust Hub Network',
  description:
    'Explore official evidence across contractors, senior care, mortgage lending, investment advisers, insurance verification, and moving in Arizona. AskTrustHub routes you to specialist research. No paid placements. No Trust Score.',
  path: PATH,
  noIndex: !gate,
});

export default function ArizonaNetworkPage() {
  const origin = BRAND.url.replace(/\/$/, '');
  const url = `${origin}${PATH}`;
  const hubs = listAzHubs();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Arizona Consumer Research | The Trust Hub Network',
        description:
          'Network gateway for Arizona specialist research. AskTrustHub is not a regulator and does not rank providers.',
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: origin },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Arizona', item: url },
        ],
      },
      {
        '@type': 'ItemList',
        name: 'Arizona specialist research hubs',
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
      <ArizonaNetworkGateway
        manifest={AZ_PUBLICATION_MANIFEST}
        releaseGatePassed={gate}
      />
    </>
  );
}
