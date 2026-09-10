import { ColoradoNetworkGateway } from '@/components/colorado-network-gateway';
import { JsonLd } from '@/lib/seo/json-ld';
import { BRAND } from '@/lib/brand';
import {
  listCoHubs,
  coReleaseGatePassed,
  CO_PUBLICATION_MANIFEST,
} from '@/lib/network/co-network';
import { createPageMetadata } from '@/lib/seo/metadata';

const PATH = '/colorado';
const gate = coReleaseGatePassed();

export const metadata = createPageMetadata({
  title: 'Colorado Consumer Research | The Trust Hub Network',
  description:
    'Explore official evidence across contractors, senior care, movers, mortgage lenders, investment advisers, and insurance in Colorado. AskTrustHub routes you to specialist research. No paid placements. No Trust Score.',
  path: PATH,
  noIndex: !gate,
});

export default function ColoradoNetworkPage() {
  const origin = BRAND.url.replace(/\/$/, '');
  const url = `${origin}${PATH}`;
  const hubs = listCoHubs();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Colorado Consumer Research | The Trust Hub Network',
        description:
          'Network gateway for Colorado specialist research. AskTrustHub is not a regulator and does not rank providers.',
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: origin },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Colorado', item: url },
        ],
      },
      {
        '@type': 'Organization',
        name: BRAND.name,
        url: origin,
      },
      {
        '@type': 'Dataset',
        name: 'Colorado Trust Hub Network research catalog',
        description:
          'Catalog of specialist-owned Colorado evidence layers. Not a ranking and not a combined record count.',
        url,
        isAccessibleForFree: true,
        creator: { '@type': 'Organization', name: BRAND.name, url: origin },
      },
      {
        '@type': 'ItemList',
        name: 'Colorado specialist research hubs',
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
      <ColoradoNetworkGateway
        manifest={CO_PUBLICATION_MANIFEST}
        releaseGatePassed={gate}
      />
    </>
  );
}
