import { HawaiiNetworkGateway } from '@/components/hawaii-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { HI_PUBLICATION_MANIFEST, hiReleaseGatePassed } from '@/lib/network/hawaii-network';

export const metadata = createPageMetadata({
  title: 'Hawaii specialist research | AskTrustHub',
  description: 'Hawaii research through six independent specialist hubs. Source clocks and regulatory populations stay separate; combined totals and rankings are not published.',
  path: '/hawaii',
  noIndex: !hiReleaseGatePassed(),
});

export default function HawaiiPage() {
  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Hawaii specialist research',
        url: HI_PUBLICATION_MANIFEST.ask_canonical,
        description: 'Gateway to six specialist-owned Hawaii sources. Separate source grains; no combined provider population or rating.',
      }} />
      <HawaiiNetworkGateway />
    </>
  );
}
