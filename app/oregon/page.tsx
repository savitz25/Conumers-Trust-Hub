import { OregonNetworkGateway } from '@/components/oregon-network-gateway';
import { JsonLd } from '@/lib/seo/json-ld';
import { BRAND } from '@/lib/brand';
import {
  listOrHubs,
  orReleaseGatePassed,
  OR_PUBLICATION_MANIFEST,
} from '@/lib/network/or-network';
import { createPageMetadata } from '@/lib/seo/metadata';

const PATH = '/oregon';
const gate = orReleaseGatePassed();

export const metadata = createPageMetadata({
  title: 'Oregon Trust Hub Research | The Trust Hub Network',
  description:
    'Explore official evidence across contractors, movers, senior care, mortgage lenders, insurance, and investment advisers in Oregon. AskTrustHub routes you to specialist research. No paid placements. No Trust Score.',
  path: PATH,
  noIndex: !gate,
});

export default function OregonNetworkPage() {
  const origin = BRAND.url.replace(/\/$/, '');
  const url = `${origin}${PATH}`;
  const hubs = listOrHubs();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Oregon Trust Hub Research | The Trust Hub Network',
        description:
          'Network gateway for Oregon specialist research. AskTrustHub is not a regulator and does not rank providers.',
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: origin },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Oregon', item: url },
        ],
      },
      {
        '@type': 'Organization',
        name: BRAND.name,
        url: origin,
      },
      {
        '@type': 'Dataset',
        name: 'Oregon Trust Hub Network research catalog',
        description:
          'Catalog of specialist-owned Oregon evidence layers. AskTrustHub is not publishing one combined Oregon record count. Specialist hubs own the underlying records.',
        url,
        isAccessibleForFree: true,
        creator: { '@type': 'Organization', name: BRAND.name, url: origin },
      },
      {
        '@type': 'ItemList',
        name: 'Oregon specialist research hubs',
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
      <OregonNetworkGateway
        manifest={OR_PUBLICATION_MANIFEST}
        releaseGatePassed={gate}
      />
    </>
  );
}
