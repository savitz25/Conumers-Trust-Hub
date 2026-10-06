import { OklahomaNetworkGateway } from '@/components/oklahoma-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { OK_PUBLICATION_MANIFEST, okReleaseGatePassed } from '@/lib/network/ok-network';

export const metadata = createPageMetadata({
  title: 'Oklahoma specialist research | AskTrustHub',
  description: 'Research Oklahoma moving, contractor, mortgage, insurance, senior care and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path: '/oklahoma', noIndex: !okReleaseGatePassed(),
});
export default function OklahomaPage() { return <>
  <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Oklahoma specialist research', url: OK_PUBLICATION_MANIFEST.ask_canonical, description: 'Gateway to six specialist-owned Oklahoma sources. No combined provider population or rating.' }} />
  <OklahomaNetworkGateway />
</>; }
