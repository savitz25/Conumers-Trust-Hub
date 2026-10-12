import { DelawareNetworkGateway } from '@/components/delaware-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { DE_PUBLICATION_MANIFEST, deReleaseGatePassed } from '@/lib/network/delaware-network';

export const metadata = createPageMetadata({
  title: 'Delaware specialist research | AskTrustHub',
  description: 'Delaware research through six independent specialist hubs. Source clocks and regulatory populations stay separate; combined totals and rankings are not published.',
  path: '/delaware',
  noIndex: !deReleaseGatePassed(),
});

export default function DelawarePage() {
  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Delaware specialist research',
        url: DE_PUBLICATION_MANIFEST.ask_canonical,
        description: 'Gateway to six specialist-owned Delaware sources. Separate source grains; no combined provider population or rating.',
      }} />
      <DelawareNetworkGateway />
    </>
  );
}
