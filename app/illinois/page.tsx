import { IllinoisNetworkGateway } from '@/components/illinois-network-gateway';
import { JsonLd } from '@/lib/seo/json-ld';
import { BRAND } from '@/lib/brand';
import {
  listIlHubs,
  ilReleaseGatePassed,
  IL_PUBLICATION_MANIFEST,
} from '@/lib/network/il-network';
import { createPageMetadata } from '@/lib/seo/metadata';

const PATH = '/illinois';
const gate = ilReleaseGatePassed();

export const metadata = createPageMetadata({
  title: 'Illinois Trust Hub Research | The Trust Hub Network',
  description:
    'Explore official evidence across contractors, movers, senior care, mortgage lenders, insurance, and investment advisers in Illinois. AskTrustHub routes you to specialist research. No paid placements. No Trust Score.',
  path: PATH,
  noIndex: !gate,
});

export default function IllinoisNetworkPage() {
  const origin = BRAND.url.replace(/\/$/, '');
  const url = `${origin}${PATH}`;
  const hubs = listIlHubs();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Illinois Trust Hub Research | The Trust Hub Network',
        description:
          'Network gateway for Illinois specialist research. AskTrustHub is not a regulator and does not rank providers.',
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: origin },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Illinois', item: url },
        ],
      },
      {
        '@type': 'Organization',
        name: BRAND.name,
        url: origin,
      },
      {
        '@type': 'Dataset',
        name: 'Illinois Trust Hub Network research catalog',
        description:
          'Catalog of specialist-owned Illinois evidence layers. Not a ranking and not a combined record count.',
        url,
        isAccessibleForFree: true,
        creator: { '@type': 'Organization', name: BRAND.name, url: origin },
      },
      {
        '@type': 'ItemList',
        name: 'Illinois specialist research hubs',
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
      <IllinoisNetworkGateway
        manifest={IL_PUBLICATION_MANIFEST}
        releaseGatePassed={gate}
      />
    </>
  );
}
