import { WashingtonNetworkGateway } from '@/components/washington-network-gateway';
import { JsonLd } from '@/lib/seo/json-ld';
import { BRAND } from '@/lib/brand';
import {
  listWaHubs,
  waReleaseGatePassed,
  WA_PUBLICATION_MANIFEST,
} from '@/lib/network/wa-network';
import { createPageMetadata } from '@/lib/seo/metadata';

const PATH = '/washington';
const gate = waReleaseGatePassed();

export const metadata = createPageMetadata({
  title: 'Washington Consumer Research | The Trust Hub Network',
  description:
    'Explore official evidence across contractors, senior care, movers, mortgage lenders, investment advisers, and insurance in Washington. AskTrustHub routes you to specialist research. No paid placements. No Trust Score.',
  path: PATH,
  noIndex: !gate,
});

export default function WashingtonNetworkPage() {
  const origin = BRAND.url.replace(/\/$/, '');
  const url = `${origin}${PATH}`;
  const hubs = listWaHubs();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Washington Consumer Research | The Trust Hub Network',
        description:
          'Network gateway for Washington specialist research. AskTrustHub is not a regulator and does not rank providers.',
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: origin },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Washington', item: url },
        ],
      },
      {
        '@type': 'ItemList',
        name: 'Washington specialist research hubs',
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
      <WashingtonNetworkGateway
        manifest={WA_PUBLICATION_MANIFEST}
        releaseGatePassed={gate}
      />
    </>
  );
}
