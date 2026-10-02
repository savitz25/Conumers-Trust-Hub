import { MichiganNetworkGateway } from '@/components/michigan-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { MI_PUBLICATION_MANIFEST, miReleaseGatePassed } from '@/lib/network/mi-network';

export const metadata = createPageMetadata({
  title: 'Michigan specialist research | AskTrustHub',
  description: 'Research Michigan moving, mortgage, contractor, insurance, senior care and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path: '/michigan', noIndex: !miReleaseGatePassed(),
});

export default function MichiganPage() {
  return <>
    <JsonLd data={{ '@context':'https://schema.org', '@type':'WebPage', name:'Michigan specialist research', url:MI_PUBLICATION_MANIFEST.ask_canonical, description:'Gateway to six specialist-owned Michigan evidence sources. No combined record population.' }} />
    <MichiganNetworkGateway />
  </>;
}
