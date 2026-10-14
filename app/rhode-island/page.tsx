import { RhodeIslandNetworkGateway } from '@/components/rhode-island-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { RI_PUBLICATION_MANIFEST, riReleaseGatePassed } from '@/lib/network/rhode-island-network';

export const metadata = createPageMetadata({
  title: 'Rhode Island specialist research | AskTrustHub',
  description: 'Rhode Island research through six independent specialist hubs. Source clocks and regulatory populations stay separate; combined totals and rankings are not published.',
  path: '/rhode-island',
  noIndex: !riReleaseGatePassed(),
});

export default function RhodeIslandPage() {
  return <>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Rhode Island specialist research', url: RI_PUBLICATION_MANIFEST.ask_canonical, description: 'Gateway to six specialist-owned Rhode Island sources. Separate source grains; no combined provider population or rating.' }} />
    <RhodeIslandNetworkGateway />
  </>;
}
