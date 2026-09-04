import { TexasNetworkGateway } from '@/components/texas-network-gateway';
import { JsonLd } from '@/lib/seo/json-ld';
import { BRAND } from '@/lib/brand';
import {
  listTxHubs,
  txReleaseGatePassed,
  TX_PUBLICATION_MANIFEST,
} from '@/lib/network/tx-network';
import { createPageMetadata } from '@/lib/seo/metadata';

const PATH = '/texas';
const gate = txReleaseGatePassed();

export const metadata = createPageMetadata({
  title: 'Texas Consumer Research | The Trust Hub Network',
  description:
    'Explore official evidence across contractors, insurance, mortgage lenders, movers, investment advisers, and senior care in Texas. AskTrustHub routes you to specialist research. No paid placements. No Trust Score.',
  path: PATH,
  noIndex: !gate,
});

export default function TexasNetworkPage() {
  const origin = BRAND.url.replace(/\/$/, '');
  const url = `${origin}${PATH}`;
  const hubs = listTxHubs();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Texas Consumer Research | The Trust Hub Network',
        description:
          'Network gateway for Texas specialist research. AskTrustHub is not a regulator and does not rank providers.',
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: origin },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Texas', item: url },
        ],
      },
      {
        '@type': 'ItemList',
        name: 'Texas specialist research hubs',
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
      <TexasNetworkGateway
        manifest={TX_PUBLICATION_MANIFEST}
        releaseGatePassed={gate}
      />
    </>
  );
}
