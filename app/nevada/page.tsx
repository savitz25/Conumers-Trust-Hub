import { NevadaNetworkGateway } from '@/components/nevada-network-gateway';
import { JsonLd } from '@/lib/seo/json-ld';
import { BRAND } from '@/lib/brand';
import { listNvHubs, nvReleaseGatePassed, NV_PUBLICATION_MANIFEST } from '@/lib/network/nv-network';
import { createPageMetadata } from '@/lib/seo/metadata';

const PATH = '/nevada';
const gate = nvReleaseGatePassed();

export const metadata = createPageMetadata({
  title: 'Nevada Trust Hub Research | The Trust Hub Network',
  description:
    'Explore official evidence across movers, contractors, mortgage lenders, insurance, senior care, and investment professionals in Nevada. AskTrustHub routes you to six specialist sources. No rankings, endorsements, or Trust Score.',
  path: PATH,
  noIndex: !gate,
});

export default function NevadaNetworkPage() {
  const origin = BRAND.url.replace(/\/$/, '');
  const url = `${origin}${PATH}`;
  const hubs = listNvHubs();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Nevada Trust Hub Research | The Trust Hub Network',
        description: 'Network gateway for Nevada specialist research. AskTrustHub is not a regulator and does not rank providers.',
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: origin },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Nevada', item: url },
        ],
      },
      {
        '@type': 'Dataset',
        name: 'Nevada Trust Hub Network research catalog',
        description:
          'Catalog of specialist-owned Nevada evidence layers. AskTrustHub does not publish one combined Nevada record count.',
        url,
        isAccessibleForFree: true,
        creator: { '@type': 'Organization', name: BRAND.name, url: origin },
      },
      {
        '@type': 'ItemList',
        name: 'Nevada specialist research hubs',
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
      <NevadaNetworkGateway manifest={NV_PUBLICATION_MANIFEST} releaseGatePassed={gate} />
    </>
  );
}
