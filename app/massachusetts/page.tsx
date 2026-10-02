import { MassachusettsNetworkGateway } from '@/components/massachusetts-network-gateway';
import { JsonLd } from '@/lib/seo/json-ld';
import { BRAND } from '@/lib/brand';
import { listMaHubs, maReleaseGatePassed, MA_PUBLICATION_MANIFEST } from '@/lib/network/ma-network';
import { createPageMetadata } from '@/lib/seo/metadata';

const PATH = '/massachusetts';
const gate = maReleaseGatePassed();

export const metadata = createPageMetadata({
  title: 'Massachusetts Trust Hub Research | The Trust Hub Network',
  description:
    'Explore official evidence across movers, contractors, mortgage lenders, insurance, senior care, and investment professionals in Massachusetts. AskTrustHub routes you to specialist research. No paid placements. No Trust Score.',
  path: PATH,
  noIndex: !gate,
});

export default function MassachusettsNetworkPage() {
  const origin = BRAND.url.replace(/\/$/, '');
  const url = `${origin}${PATH}`;
  const hubs = listMaHubs();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Massachusetts Trust Hub Research | The Trust Hub Network',
        description: 'Network gateway for Massachusetts specialist research. AskTrustHub is not a regulator and does not rank providers.',
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: origin },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Massachusetts', item: url },
        ],
      },
      {
        '@type': 'Dataset',
        name: 'Massachusetts Trust Hub Network research catalog',
        description:
          'Catalog of specialist-owned Massachusetts evidence layers. AskTrustHub is not publishing one combined Massachusetts record count.',
        url,
        isAccessibleForFree: true,
        creator: { '@type': 'Organization', name: BRAND.name, url: origin },
      },
      {
        '@type': 'ItemList',
        name: 'Massachusetts specialist research hubs',
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
      <MassachusettsNetworkGateway manifest={MA_PUBLICATION_MANIFEST} releaseGatePassed={gate} />
    </>
  );
}
