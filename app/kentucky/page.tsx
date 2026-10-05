import { KentuckyNetworkGateway } from '@/components/kentucky-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { KY_PUBLICATION_MANIFEST, kyReleaseGatePassed } from '@/lib/network/ky-network';

export const metadata=createPageMetadata({
  title:'Kentucky specialist research | AskTrustHub',
  description:'Research Kentucky moving, contractor, mortgage, insurance, senior care and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path:'/kentucky',noIndex:!kyReleaseGatePassed(),
});
export default function KentuckyPage(){return <>
  <JsonLd data={{'@context':'https://schema.org','@type':'WebPage',name:'Kentucky specialist research',url:KY_PUBLICATION_MANIFEST.ask_canonical,description:'Gateway to six specialist-owned Kentucky evidence sources. No combined record population.'}} />
  <KentuckyNetworkGateway />
</>;}
