import { IndianaNetworkGateway } from '@/components/indiana-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { IN_PUBLICATION_MANIFEST, inReleaseGatePassed } from '@/lib/network/in-network';

export const metadata=createPageMetadata({
  title:'Indiana specialist research | AskTrustHub',
  description:'Research Indiana moving, plumbing contractor, mortgage, insurance, senior care and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path:'/indiana',noIndex:!inReleaseGatePassed(),
});
export default function IndianaPage(){return <>
  <JsonLd data={{'@context':'https://schema.org','@type':'WebPage',name:'Indiana specialist research',url:IN_PUBLICATION_MANIFEST.ask_canonical,description:'Gateway to six specialist-owned Indiana evidence sources. No combined record population.'}} />
  <IndianaNetworkGateway />
</>;}
