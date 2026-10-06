import { LouisianaNetworkGateway } from '@/components/louisiana-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { LA_PUBLICATION_MANIFEST, laReleaseGatePassed } from '@/lib/network/la-network';

export const metadata=createPageMetadata({
  title:'Louisiana specialist research | AskTrustHub',
  description:'Research Louisiana moving, contractor, mortgage, insurance, senior care and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path:'/louisiana',noIndex:!laReleaseGatePassed(),
});
export default function LouisianaPage(){return <>
  <JsonLd data={{'@context':'https://schema.org','@type':'WebPage',name:'Louisiana specialist research',url:LA_PUBLICATION_MANIFEST.ask_canonical,description:'Gateway to six specialist-owned Louisiana evidence sources. No combined record population.'}} />
  <LouisianaNetworkGateway />
</>;}
