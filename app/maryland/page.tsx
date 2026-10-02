import { MarylandNetworkGateway } from '@/components/maryland-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { MD_PUBLICATION_MANIFEST, mdReleaseGatePassed } from '@/lib/network/md-network';

export const metadata = createPageMetadata({
  title: 'Maryland specialist research | AskTrustHub',
  description: 'Research Maryland moving, contractor, mortgage, insurance, senior care and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path: '/maryland', noIndex: !mdReleaseGatePassed(),
});
export default function MarylandPage() {
  return <>
    <JsonLd data={{ '@context':'https://schema.org', '@type':'WebPage', name:'Maryland specialist research', url:MD_PUBLICATION_MANIFEST.ask_canonical, description:'Gateway to six specialist-owned Maryland evidence sources. No combined record population.' }} />
    <MarylandNetworkGateway />
  </>;
}
