import { WisconsinNetworkGateway } from '@/components/wisconsin-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { WI_PUBLICATION_MANIFEST, wiReleaseGatePassed } from '@/lib/network/wi-network';

export const metadata = createPageMetadata({
  title: 'Wisconsin specialist research | AskTrustHub',
  description: 'Research Wisconsin moving, contractor, mortgage, insurance, senior care and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path: '/wisconsin', noIndex: !wiReleaseGatePassed(),
});
export default function WisconsinPage() {
  return <>
    <JsonLd data={{ '@context':'https://schema.org', '@type':'WebPage', name:'Wisconsin specialist research', url:WI_PUBLICATION_MANIFEST.ask_canonical, description:'Gateway to six specialist-owned Wisconsin evidence sources. No combined record population.' }} />
    <WisconsinNetworkGateway />
  </>;
}

