import { IowaNetworkGateway } from '@/components/iowa-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { IA_PUBLICATION_MANIFEST, iaReleaseGatePassed } from '@/lib/network/ia-network';

export const metadata = createPageMetadata({
  title: 'Iowa specialist research | AskTrustHub',
  description: 'Research Iowa moving, contractor, mortgage, insurance, senior care and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path: '/iowa', noIndex: !iaReleaseGatePassed(),
});
export default function IowaPage() { return <>
  <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Iowa specialist research', url: IA_PUBLICATION_MANIFEST.ask_canonical, description: 'Gateway to six specialist-owned Iowa sources. No combined provider population or rating.' }} />
  <IowaNetworkGateway />
</>; }
