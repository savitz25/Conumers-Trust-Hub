import { NewHampshireNetworkGateway } from '@/components/new-hampshire-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { NH_PUBLICATION_MANIFEST, nhReleaseGatePassed } from '@/lib/network/new-hampshire-network';

export const metadata = createPageMetadata({
  title: 'New Hampshire specialist research | AskTrustHub',
  description: 'New Hampshire research through six independent specialist hubs. Source clocks and regulatory populations stay separate; combined totals and rankings are not published.',
  path: '/new-hampshire',
  noIndex: !nhReleaseGatePassed(),
});

export default function NewHampshirePage() {
  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'New Hampshire specialist research',
        url: NH_PUBLICATION_MANIFEST.ask_canonical,
        description: 'Gateway to six specialist-owned New Hampshire sources. Separate source grains; no combined provider population or rating.',
      }} />
      <NewHampshireNetworkGateway />
    </>
  );
}
