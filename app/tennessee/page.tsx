import { TennesseeNetworkGateway } from '@/components/tennessee-network-gateway';
import { JsonLd } from '@/lib/seo/json-ld';
import { BRAND } from '@/lib/brand';
import { listTnHubs, tnReleaseGatePassed, TN_PUBLICATION_MANIFEST } from '@/lib/network/tn-network';
import { createPageMetadata } from '@/lib/seo/metadata';

const PATH = '/tennessee';
const gate = tnReleaseGatePassed();

export const metadata = createPageMetadata({
  title: 'Tennessee Trust Hub Research | The Trust Hub Network',
  description:
    'Explore official evidence across movers, contractors, mortgage lenders, insurance, senior care, and investment professionals in Tennessee. AskTrustHub routes you to six specialist sources. No rankings, endorsements, or Trust Score.',
  path: PATH,
  noIndex: !gate,
});

export default function TennesseeNetworkPage() {
  const origin = BRAND.url.replace(/\/$/, '');
  const url = `${origin}${PATH}`;
  const hubs = listTnHubs();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Tennessee Trust Hub Research | The Trust Hub Network',
        description: 'Network gateway for Tennessee specialist research. AskTrustHub is not a regulator and does not rank providers.',
        url,
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: origin },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Tennessee', item: url },
        ],
      },
      {
        '@type': 'Dataset',
        name: 'Tennessee Trust Hub Network research catalog',
        description:
          'Catalog of specialist-owned Tennessee evidence layers. AskTrustHub does not publish one combined Tennessee record count.',
        url,
        isAccessibleForFree: true,
        creator: { '@type': 'Organization', name: BRAND.name, url: origin },
      },
      {
        '@type': 'ItemList',
        name: 'Tennessee specialist research hubs',
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
      <TennesseeNetworkGateway manifest={TN_PUBLICATION_MANIFEST} releaseGatePassed={gate} />
    </>
  );
}
