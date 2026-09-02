import type { CustomerHubId, CustomerProfileRecord, HandoffPayload } from './types.ts';

export type CustomerHubCapability = {
  hubId: CustomerHubId;
  displayName: string;
  claim: 'SUPPORTED';
  identityClass: CustomerProfileRecord['entityClass'];
  identifierNamespace: 'credential' | 'USDOT' | 'NMLS';
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
  if(!cap || payload.identifier_namespace && payload.identifier_namespace!==cap.identifierNamespace || payload.entity_class && payload.entity_class!==cap.identityClass) return null;
  return cap;
}
