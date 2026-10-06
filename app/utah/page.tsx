import { UtahNetworkGateway } from '@/components/utah-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { UT_PUBLICATION_MANIFEST, utReleaseGatePassed } from '@/lib/network/ut-network';

export const metadata = createPageMetadata({
  title: 'Utah specialist research | AskTrustHub',
  description: 'Research Utah moving, contractor, mortgage, insurance, senior care and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path: '/utah', noIndex: !utReleaseGatePassed(),
});
export default function UtahPage() { return <>
  <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Utah specialist research', url: UT_PUBLICATION_MANIFEST.ask_canonical, description: 'Gateway to six specialist-owned Utah sources. No combined provider population or rating.' }} />
  <UtahNetworkGateway />
</>; }
