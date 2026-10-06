import { NewMexicoNetworkGateway } from '@/components/new-mexico-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { NM_PUBLICATION_MANIFEST, nmReleaseGatePassed } from '@/lib/network/nm-network';

export const metadata = createPageMetadata({
  title: 'New Mexico specialist research | AskTrustHub',
  description: 'Research New Mexico moving, contractor, mortgage, insurance, senior care and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path: '/new-mexico', noIndex: !nmReleaseGatePassed(),
});
export default function NewMexicoPage() { return <>
  <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'New Mexico specialist research', url: NM_PUBLICATION_MANIFEST.ask_canonical, description: 'Gateway to six specialist-owned New Mexico sources. No combined provider population or rating.' }} />
  <NewMexicoNetworkGateway />
</>; }
