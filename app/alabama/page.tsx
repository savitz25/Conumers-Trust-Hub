import { AlabamaNetworkGateway } from '@/components/alabama-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { AL_PUBLICATION_MANIFEST, alReleaseGatePassed } from '@/lib/network/al-network';

export const metadata=createPageMetadata({
  title:'Alabama specialist research | AskTrustHub',
  description:'Research Alabama moving, contractor, mortgage, insurance, senior care and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path:'/alabama',noIndex:!alReleaseGatePassed(),
});
export default function AlabamaPage(){return <>
  <JsonLd data={{'@context':'https://schema.org','@type':'WebPage',name:'Alabama specialist research',url:AL_PUBLICATION_MANIFEST.ask_canonical,description:'Gateway to six specialist-owned Alabama evidence sources. No combined record population.'}} />
  <AlabamaNetworkGateway />
</>;}
