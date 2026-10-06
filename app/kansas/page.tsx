import { KansasNetworkGateway } from '@/components/kansas-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { KS_PUBLICATION_MANIFEST, ksReleaseGatePassed } from '@/lib/network/ks-network';

export const metadata = createPageMetadata({
  title: 'Kansas specialist research | AskTrustHub',
  description: 'Kansas source-backed research through six specialist hubs, with licensing, people, facilities, firms, and market observations kept separate.',
  path: '/kansas',
  noIndex: !ksReleaseGatePassed(),
});

export default function KansasPage() {
  return <>
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Kansas specialist research',
      url: KS_PUBLICATION_MANIFEST.ask_canonical,
      description: 'Gateway to six specialist-owned Kansas sources. No combined provider population or rating.',
    }} />
    <KansasNetworkGateway />
  </>;
}
