import { MaineNetworkGateway } from '@/components/maine-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { ME_PUBLICATION_MANIFEST, meReleaseGatePassed } from '@/lib/network/maine-network';

export const metadata = createPageMetadata({
  title: 'Maine specialist research | AskTrustHub',
  description: 'Maine research through six independent specialist hubs. Source clocks and regulatory populations stay separate; combined totals and rankings are not published.',
  path: '/maine',
  noIndex: !meReleaseGatePassed(),
});

export default function MainePage() {
  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Maine specialist research',
        url: ME_PUBLICATION_MANIFEST.ask_canonical,
        description: 'Gateway to six specialist-owned Maine sources. Separate source grains; no combined provider population or rating.',
      }} />
      <MaineNetworkGateway />
    </>
  );
}
