import { MissouriNetworkGateway } from '@/components/missouri-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { MO_PUBLICATION_MANIFEST, moReleaseGatePassed } from '@/lib/network/mo-network';

export const metadata = createPageMetadata({
  title: 'Missouri specialist research | AskTrustHub',
  description: 'Research Missouri moving, contractor, mortgage, insurance, senior care and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path: '/missouri', noIndex: !moReleaseGatePassed(),
});
export default function MissouriPage() { return <>
  <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Missouri specialist research', url: MO_PUBLICATION_MANIFEST.ask_canonical, description: 'Gateway to six specialist-owned Missouri sources. No combined provider population or rating.' }} />
  <MissouriNetworkGateway />
</>; }
