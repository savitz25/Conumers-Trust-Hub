import { NorthDakotaNetworkGateway } from '@/components/north-dakota-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { ND_PUBLICATION_MANIFEST, ndReleaseGatePassed } from '@/lib/network/north-dakota-network';

export const metadata = createPageMetadata({
  title: 'North Dakota specialist research | AskTrustHub',
  description: 'North Dakota research through six independent specialist hubs. Source clocks and regulatory populations stay separate; combined totals and rankings are not published.',
  path: '/north-dakota',
  noIndex: !ndReleaseGatePassed(),
});

export default function NorthDakotaPage() {
  return <>
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'North Dakota specialist research',
      url: ND_PUBLICATION_MANIFEST.ask_canonical,
      description: 'Gateway to six specialist-owned North Dakota sources. Separate source grains; no combined provider population or rating.',
    }} />
    <NorthDakotaNetworkGateway />
  </>;
}
