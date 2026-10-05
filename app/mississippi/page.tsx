import { MississippiNetworkGateway } from '@/components/mississippi-network-gateway';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/lib/seo/json-ld';
import { MS_PUBLICATION_MANIFEST, msReleaseGatePassed } from '@/lib/network/ms-network';

export const metadata=createPageMetadata({
  title:'Mississippi specialist research | AskTrustHub',
  description:'Research Mississippi moving, contractor, mortgage, insurance, senior care and investment evidence through six independent specialist hubs. No combined total or ranking.',
  path:'/mississippi',noIndex:!msReleaseGatePassed(),
});
export default function MississippiPage(){return <>
  <JsonLd data={{'@context':'https://schema.org','@type':'WebPage',name:'Mississippi specialist research',url:MS_PUBLICATION_MANIFEST.ask_canonical,description:'Gateway to six specialist-owned Mississippi evidence sources. No combined record population.'}} />
  <MississippiNetworkGateway />
</>;}
