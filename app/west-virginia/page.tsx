import { WestVirginiaNetworkGateway } from '@/components/west-virginia-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { WV_PUBLICATION_MANIFEST, wvReleaseGatePassed } from '@/lib/network/wv-network';

export const metadata = createPageMetadata({
  title: 'West Virginia specialist research | AskTrustHub',
  description: 'Research West Virginia moving, contractor, mortgage, insurance, senior care, and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path: '/west-virginia', noIndex: !wvReleaseGatePassed(),
});

export default function WestVirginiaPage() {
  return <>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'West Virginia specialist research', url: WV_PUBLICATION_MANIFEST.ask_canonical, description: 'Gateway to six specialist-owned West Virginia sources. No combined provider population or rating.' }} />
    <WestVirginiaNetworkGateway />
  </>;
}
