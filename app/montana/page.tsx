import { MontanaNetworkGateway } from '@/components/montana-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { MT_PUBLICATION_MANIFEST, mtReleaseGatePassed } from '@/lib/network/montana-network';

export const metadata = createPageMetadata({
  title: 'Montana specialist research | AskTrustHub',
  description: 'Montana research through six independent specialist hubs. Source clocks and regulatory populations stay separate; combined totals and rankings are not published.',
  path: '/montana',
  noIndex: !mtReleaseGatePassed(),
});

export default function MontanaPage() {
  return <>
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Montana specialist research',
      url: MT_PUBLICATION_MANIFEST.ask_canonical,
      description: 'Gateway to six specialist-owned Montana sources. Separate source grains; no combined provider population or rating.',
    }} />
    <MontanaNetworkGateway />
  </>;
}
