import type { CustomerHubId, CustomerProfileRecord, HandoffPayload } from './types.ts';

export type CustomerHubCapability = {
  hubId: CustomerHubId;
  displayName: string;
  claim: 'SUPPORTED';
  identityClass: CustomerProfileRecord['entityClass'];
  identityClasses?: readonly CustomerProfileRecord['entityClass'][];
  identifierNamespace: 'credential' | 'USDOT' | 'NMLS' | 'CMS_CCN' | 'CRD';
  publicationRequired: true;
  layerC: true;
  businessResponse: true;
  monitoring: 'SUPPORTED' | 'UNAVAILABLE';
  identifierLabel: string;
  destinationOrigin: string;
};

export const CUSTOMER_HUB_REGISTRY: Record<CustomerHubId, CustomerHubCapability> = {
  contractor: { hubId:'contractor',displayName:'ContractorTrustHub',claim:'SUPPORTED',identityClass:'contractor',identifierNamespace:'credential',publicationRequired:true,layerC:true,businessResponse:true,monitoring:'SUPPORTED',identifierLabel:'Credential',destinationOrigin:'https://www.contractortrusthub.com' },
  move: { hubId:'move',displayName:'MoveTrustHub',claim:'SUPPORTED',identityClass:'mover',identifierNamespace:'USDOT',publicationRequired:true,layerC:true,businessResponse:true,monitoring:'UNAVAILABLE',identifierLabel:'USDOT',destinationOrigin:'https://www.movetrusthub.com' },
  lender: { hubId:'lender',displayName:'LenderTrustHub',claim:'SUPPORTED',identityClass:'institution',identifierNamespace:'NMLS',publicationRequired:true,layerC:true,businessResponse:true,monitoring:'UNAVAILABLE',identifierLabel:'NMLS',destinationOrigin:'https://www.lendertrusthub.com' },
  senior: { hubId:'senior',displayName:'SeniorTrustHub',claim:'SUPPORTED',identityClass:'nursing_home',identityClasses:['nursing_home','home_health','hospice'],identifierNamespace:'CMS_CCN',publicationRequired:true,layerC:true,businessResponse:true,monitoring:'UNAVAILABLE',identifierLabel:'CMS CCN',destinationOrigin:'https://www.seniortrusthub.com' },
  investor: { hubId:'investor',displayName:'InvestorTrustHub',claim:'SUPPORTED',identityClass:'firm',identifierNamespace:'CRD',publicationRequired:true,layerC:true,businessResponse:true,monitoring:'UNAVAILABLE',identifierLabel:'CRD',destinationOrigin:'https://www.investortrusthub.com' },
};

export function customerHub(value: unknown): CustomerHubCapability | null {
  return typeof value === 'string' && value in CUSTOMER_HUB_REGISTRY
    ? CUSTOMER_HUB_REGISTRY[value as CustomerHubId] : null;
}

export function publicProfileDestination(profile: Pick<CustomerProfileRecord,'hubId'|'canonicalUrl'>): string | null {
  const cap=customerHub(profile.hubId);
  if(!cap) return null;
  try { const url=new URL(profile.canonicalUrl,cap.destinationOrigin); return url.origin===cap.destinationOrigin?url.toString():null; }
  catch { return null; }
}

export function handoffCapability(payload: HandoffPayload): CustomerHubCapability | null {
  const cap=customerHub(payload.hub_id);
  const seniorClass=payload.provider_class;
  if(!cap || payload.identifier_namespace && payload.identifier_namespace!==cap.identifierNamespace) return null;
  if(payload.hub_id==='senior') {
    if(!seniorClass || !['nursing_home','home_health','hospice'].includes(seniorClass) || payload.entity_class!==seniorClass) return null;
  } else if(payload.entity_class && payload.entity_class!==cap.identityClass) return null;
  return cap;
}

export function customerEntityClassLabel(value: unknown): string {
  return value==='nursing_home'?'Nursing Home':value==='home_health'?'Home Health':value==='hospice'?'Hospice':value==='institution'?'Institution':value==='firm'?'Firm':value==='mover'?'Mover':'Contractor';
}
