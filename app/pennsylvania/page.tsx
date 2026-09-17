import { PennsylvaniaNetworkGateway } from '@/components/pennsylvania-network-gateway';
import { JsonLd } from '@/lib/seo/json-ld';
import { BRAND } from '@/lib/brand';
import {
  listPaHubs,
  paReleaseGatePassed,
  PA_PUBLICATION_MANIFEST,
} from '@/lib/network/pa-network';
import { createPageMetadata } from '@/lib/seo/metadata';

const PATH = '/pennsylvania';
const gate = paReleaseGatePassed();

export const metadata = createPageMetadata({
  title: 'Pennsylvania Trust Hub Research | The Trust Hub Network',
  description:
    'Explore official evidence across contractors, movers, senior care, mortgage lenders, insurance, and investment advisers in Pennsylvania. AskTrustHub routes you to specialist research. No paid placements. No Trust Score.',
  path: PATH,
  noIndex: !gate,
});

export default function PennsylvaniaNetworkPage() {
  const origin = BRAND.url.replace(/\/$/, '');
  const url = `${origin}${PATH}`;
  const hubs = listPaHubs();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Pennsylvania Trust Hub Research | The Trust Hub Network',
        description:
          'Network gateway for Pennsylvania specialist research. AskTrustHub is not a regulator and does not rank providers.',
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: origin },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Pennsylvania', item: url },
        ],
      },
      {
        '@type': 'Organization',
        name: BRAND.name,
        url: origin,
      },
      {
        '@type': 'Dataset',
        name: 'Pennsylvania Trust Hub Network research catalog',
        description:
          'Catalog of specialist-owned Pennsylvania evidence layers. AskTrustHub is not publishing one combined Pennsylvania record count. Specialist hubs own the underlying records.',
        url,
        isAccessibleForFree: true,
        creator: { '@type': 'Organization', name: BRAND.name, url: origin },
      },
      {
        '@type': 'ItemList',
        name: 'Pennsylvania specialist research hubs',
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
      <PennsylvaniaNetworkGateway
        manifest={PA_PUBLICATION_MANIFEST}
        releaseGatePassed={gate}
      />
    </>
  );
}
