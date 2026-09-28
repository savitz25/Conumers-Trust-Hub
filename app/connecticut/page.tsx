import { ConnecticutNetworkGateway } from '@/components/connecticut-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { CT_PUBLICATION_MANIFEST, ctReleaseGatePassed } from '@/lib/network/ct-network';

export const metadata = createPageMetadata({
  title: 'Connecticut specialist research | AskTrustHub',
  description: 'Research Connecticut moving, contractor, mortgage, insurance, senior care and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path: '/connecticut', noIndex: !ctReleaseGatePassed(),
});

export default function ConnecticutPage() {
  return <>
    <JsonLd data={{ '@context':'https://schema.org', '@type':'WebPage', name:'Connecticut specialist research', url:CT_PUBLICATION_MANIFEST.ask_canonical, description:'Gateway to six specialist-owned Connecticut evidence sources. No combined record population.' }} />
    <ConnecticutNetworkGateway />
  </>;
}
