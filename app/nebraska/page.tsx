import { NebraskaNetworkGateway } from '@/components/nebraska-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { NE_PUBLICATION_MANIFEST, neReleaseGatePassed } from '@/lib/network/ne-network';

export const metadata = createPageMetadata({
  title: 'Nebraska specialist research | AskTrustHub',
  description: 'Research Nebraska moving, contractor, mortgage, insurance, senior care, and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path: '/nebraska', noIndex: !neReleaseGatePassed(),
});

export default function NebraskaPage() {
  return <>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Nebraska specialist research', url: NE_PUBLICATION_MANIFEST.ask_canonical, description: 'Gateway to six specialist-owned Nebraska sources. No combined provider population or rating.' }} />
    <NebraskaNetworkGateway />
  </>;
}
