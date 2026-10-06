import { ArkansasNetworkGateway } from '@/components/arkansas-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { AR_PUBLICATION_MANIFEST, arReleaseGatePassed } from '@/lib/network/ar-network';

export const metadata = createPageMetadata({
  title: 'Arkansas specialist research | AskTrustHub',
  description: 'Research Arkansas moving, contractor, mortgage, insurance, senior care and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path: '/arkansas', noIndex: !arReleaseGatePassed(),
});
export default function ArkansasPage() { return <>
  <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Arkansas specialist research', url: AR_PUBLICATION_MANIFEST.ask_canonical, description: 'Gateway to six specialist-owned Arkansas sources. No combined provider population or rating.' }} />
  <ArkansasNetworkGateway />
</>; }
