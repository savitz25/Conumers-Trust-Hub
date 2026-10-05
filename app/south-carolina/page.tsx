import { SouthCarolinaNetworkGateway } from '@/components/south-carolina-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { SC_PUBLICATION_MANIFEST, scReleaseGatePassed } from '@/lib/network/sc-network';

export const metadata=createPageMetadata({
  title:'South Carolina specialist research | AskTrustHub',
  description:'Research South Carolina moving, contractor, mortgage, insurance, senior care and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path:'/south-carolina',noIndex:!scReleaseGatePassed(),
});
export default function SouthCarolinaPage(){return <>
  <JsonLd data={{'@context':'https://schema.org','@type':'WebPage',name:'South Carolina specialist research',url:SC_PUBLICATION_MANIFEST.ask_canonical,description:'Gateway to six specialist-owned South Carolina evidence sources. No combined record population.'}} />
  <SouthCarolinaNetworkGateway />
</>;}
