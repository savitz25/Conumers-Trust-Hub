import type { SpecialistHubId } from './registry.ts';

export const GEOGRAPHY_MEANINGS = ['RECORDED_HEADQUARTERS','RECORDED_OFFICE_LOCATION','RECORDED_PROVIDER_LOCATION','LICENSE_JURISDICTION','CREDENTIAL_GEOGRAPHY','PROPERTY_GEOGRAPHY','PRINCIPAL_OFFICE','SERVICE_TERRITORY','SERVICE_AVAILABILITY','ORIGIN','DESTINATION','ORIGIN_DESTINATION'] as const;
export type AskGeographyMeaning=(typeof GEOGRAPHY_MEANINGS)[number];
export type ExecutableGeographyKind='national'|'state'|'county'|'city'|'zip';

export type GeographyCapability={
  hub:SpecialistHubId;
  entityClasses:'*'|readonly string[];
  supportedKinds:readonly ExecutableGeographyKind[];
  meaning:AskGeographyMeaning;
  localToStateRequiresConsent:boolean;
  disclosure:string;
  supportedFloridaCounties?:readonly string[];
};

export const SPECIALIST_GEOGRAPHY_CAPABILITIES:readonly GeographyCapability[]=[
  {hub:'move',entityClasses:'*',supportedKinds:['state'],meaning:'RECORDED_HEADQUARTERS',localToStateRequiresConsent:true,disclosure:'The current accepted Move contract supports recorded-headquarters state, not city service availability. Recorded headquarters does not establish service territory or route availability.'},
  {hub:'contractor',entityClasses:'*',supportedKinds:['state','county'],meaning:'CREDENTIAL_GEOGRAPHY',localToStateRequiresConsent:true,supportedFloridaCounties:['Broward','Palm Beach'],disclosure:'Credential/source geography does not establish service territory, availability, endorsement, or good standing.'},
  {hub:'investor',entityClasses:'*',supportedKinds:['state'],meaning:'PRINCIPAL_OFFICE',localToStateRequiresConsent:true,disclosure:'Principal-office geography does not establish client geography or service territory.'},
  {hub:'insurance',entityClasses:'*',supportedKinds:['state'],meaning:'CREDENTIAL_GEOGRAPHY',localToStateRequiresConsent:true,disclosure:'Credential jurisdiction does not establish office location, appointments, service territory, or product availability.'},
  {hub:'lender',entityClasses:'*',supportedKinds:['state','county'],meaning:'PROPERTY_GEOGRAPHY',localToStateRequiresConsent:true,supportedFloridaCounties:['Broward','Palm Beach'],disclosure:'HMDA property geography is not lender headquarters, branch location, licensing, or current service territory.'},
  {hub:'senior',entityClasses:['nursing_home'],supportedKinds:['state','county','city','zip'],meaning:'RECORDED_PROVIDER_LOCATION',localToStateRequiresConsent:true,disclosure:'Recorded provider location is not a radius search or verified service area.'},
  {hub:'senior',entityClasses:['home_health'],supportedKinds:['state','city','zip'],meaning:'RECORDED_OFFICE_LOCATION',localToStateRequiresConsent:true,disclosure:'Home Health office geography is not patient service availability.'},
  {hub:'senior',entityClasses:['hospice'],supportedKinds:['state','county','city'],meaning:'RECORDED_OFFICE_LOCATION',localToStateRequiresConsent:true,disclosure:'Hospice office geography is not patient service availability.'},
] as const;

export function geographyCapability(hub:SpecialistHubId,entityClass?:string):GeographyCapability|undefined{
  return SPECIALIST_GEOGRAPHY_CAPABILITIES.find(row=>row.hub===hub&&(row.entityClasses==='*'||Boolean(entityClass&&row.entityClasses.includes(entityClass))));
}
