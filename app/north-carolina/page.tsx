import { NorthCarolinaNetworkGateway } from '@/components/north-carolina-network-gateway';
import { JsonLd } from '@/lib/seo/json-ld';
import { BRAND } from '@/lib/brand';
import {
  listNcHubs,
  ncReleaseGatePassed,
  NC_PUBLICATION_MANIFEST,
} from '@/lib/network/nc-network';
import { createPageMetadata } from '@/lib/seo/metadata';

const PATH = '/north-carolina';
const gate = ncReleaseGatePassed();

export const metadata = createPageMetadata({
  title: 'North Carolina Trust Hub Research | The Trust Hub Network',
  description:
    'Explore official evidence across contractors, movers, senior care, mortgage lenders, insurance, and investment advisers in North Carolina. AskTrustHub routes you to specialist research. No paid placements. No Trust Score.',
  path: PATH,
  noIndex: !gate,
});

export default function NorthCarolinaNetworkPage() {
  const origin = BRAND.url.replace(/\/$/, '');
  const url = `${origin}${PATH}`;
  const hubs = listNcHubs();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'North Carolina Trust Hub Research | The Trust Hub Network',
        description:
          'Network gateway for North Carolina specialist research. AskTrustHub is not a regulator and does not rank providers.',
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: origin },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'North Carolina', item: url },
        ],
      },
      {
        '@type': 'Organization',
        name: BRAND.name,
        url: origin,
      },
      {
        '@type': 'Dataset',
        name: 'North Carolina Trust Hub Network research catalog',
        description:
          'Catalog of specialist-owned North Carolina evidence layers. AskTrustHub is not publishing one combined North Carolina record count. Specialist hubs own the underlying records.',
        url,
        isAccessibleForFree: true,
        creator: { '@type': 'Organization', name: BRAND.name, url: origin },
      },
      {
        '@type': 'ItemList',
        name: 'North Carolina specialist research hubs',
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
      <NorthCarolinaNetworkGateway
        manifest={NC_PUBLICATION_MANIFEST}
        releaseGatePassed={gate}
      />
    </>
  );
}
