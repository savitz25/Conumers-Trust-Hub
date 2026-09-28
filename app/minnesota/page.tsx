import { MinnesotaNetworkGateway } from '@/components/minnesota-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { MN_PUBLICATION_MANIFEST, mnReleaseGatePassed } from '@/lib/network/mn-network';

export const metadata = createPageMetadata({
  title: 'Minnesota specialist research | AskTrustHub',
  description: 'Research Minnesota moving, mortgage, contractor, insurance, senior care and investment evidence through six independent specialist hubs.',
  path: '/minnesota', noIndex: !mnReleaseGatePassed(),
});

export default function MinnesotaPage() {
  return <>
    <JsonLd data={{ '@context':'https://schema.org', '@type':'WebPage', name:'Minnesota specialist research', url:MN_PUBLICATION_MANIFEST.ask_canonical, description:'Gateway to six specialist-owned evidence sources. No combined record population.' }} />
    <MinnesotaNetworkGateway />
  </>;
}
