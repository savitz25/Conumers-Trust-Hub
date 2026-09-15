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
  // TH-DISCOVERY-003: 'city' added -- MoveTrustHub's specialist now has a real, additive recorded-
  // headquarters-CITY filter (lib/directory/coverage-filter.ts's extractCityFromHeadquarters,
  // paired with the existing recorded-headquarters-STATE filter; never a service-territory claim).
  // A bare city with no resolvable state still falls through to state-broadening consent below
  // (unaffected -- see research-scope.ts's normalized.kind==='city' handling), and Tampa Bay (a
  // region, not a city) is unaffected by this and still requires the same consent.
  {hub:'move',entityClasses:'*',supportedKinds:['state','city'],meaning:'RECORDED_HEADQUARTERS',localToStateRequiresConsent:true,disclosure:'The current accepted Move contract supports recorded-headquarters state and city, not service availability. Recorded headquarters does not establish service territory or route availability.'},
  // TH-DISCOVERY-003: this list was undersold at just Broward/Palm Beach -- live-confirmed against
  // ContractorTrustHub's specialist (lib/specialist-execution/contractor-v2.ts, which resolves
  // county via its own FLORIDA_COUNTIES list in lib/discovery/counties.ts) that all 30 of these
  // counties genuinely execute (e.g. Orange/Duval/Lee/Volusia all returned real SUPPORTED_RESULTS
  // rows), while a real FL county outside this exact list (e.g. Hendry) correctly fails closed
  // with errorCode 'unsupported_florida_county' -- so this is the true, authoritative boundary of
  // the specialist's own county support, not an arbitrary subset.
  {hub:'contractor',entityClasses:'*',supportedKinds:['state','county'],meaning:'CREDENTIAL_GEOGRAPHY',localToStateRequiresConsent:true,supportedFloridaCounties:['Miami-Dade','Broward','Palm Beach','Hillsborough','Orange','Pinellas','Duval','Lee','Collier','Sarasota','Manatee','Pasco','Polk','Brevard','Volusia','Seminole','Osceola','Marion','Lake','St. Lucie','Martin','Indian River','Charlotte','Escambia','Leon','Alachua','Bay','Okaloosa','St. Johns','Clay'],disclosure:'Credential/source geography does not establish service territory, availability, endorsement, or good standing.'},
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
