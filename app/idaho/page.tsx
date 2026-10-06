import { IdahoNetworkGateway } from '@/components/idaho-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { ID_PUBLICATION_MANIFEST, idReleaseGatePassed } from '@/lib/network/id-network';

export const metadata = createPageMetadata({
  title: 'Idaho specialist research | AskTrustHub',
  description: 'Research Idaho moving, contractor, mortgage, insurance, senior care and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path: '/idaho', noIndex: !idReleaseGatePassed(),
});
export default function IdahoPage() { return <>
  <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Idaho specialist research', url: ID_PUBLICATION_MANIFEST.ask_canonical, description: 'Gateway to six specialist-owned Idaho sources. No combined provider population or rating.' }} />
  <IdahoNetworkGateway />
</>; }
