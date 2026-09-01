import { HUB_CAPABILITY_REGISTRY } from './capability-registry.ts';
import { SPECIALIST_HUB_IDS, type SpecialistHubId } from './registry.ts';

export type HubCapabilityContract = {
  hubId: SpecialistHubId;
  supportedEntityClasses: readonly string[];
  identifiers: readonly string[];
  nameSearchModes: readonly ('canonical' | 'public_name' | 'normalized' | 'none')[];
  geographyLevels: readonly ('national' | 'state' | 'county' | 'city')[];
  geographySemantics: string;
  filters: readonly string[];
  publicationSemantics: string;
  resultCapabilities: readonly string[];
  sourceClocks: readonly string[];
  canonicalDestination: string;
};

const DETAILS: Record<SpecialistHubId, Omit<HubCapabilityContract, 'hubId' | 'canonicalDestination'>> = {
  move: { supportedEntityClasses: ['carrier', 'broker'], identifiers: ['USDOT', 'MC'], nameSearchModes: ['canonical', 'public_name', 'normalized'], geographyLevels: ['national', 'state'], geographySemantics: 'Recorded headquarters; never service territory.', filters: ['role', 'headquarters_state', 'authority', 'auto_transport_handoff'], publicationSemantics: 'Only Move-published identities may be represented as published profiles. Auto Transport is a source-backed specialist handoff, not an Ask-owned cohort.', resultCapabilities: ['identity', 'cohort', 'evidence', 'auto_transport_handoff'], sourceClocks: ['FMCSA last checked', 'FMCSA Company Census rowsUpdatedAt', 'FDACS retrieved_at'] },
  lender: { supportedEntityClasses: ['institution'], identifiers: ['NMLS', 'LEI'], nameSearchModes: ['normalized'], geographyLevels: ['national', 'state', 'county'], geographySemantics: 'HMDA property geography; never headquarters or service territory.', filters: ['loan_type', 'property_geography', 'period'], publicationSemantics: 'Research identities may exist without a public profile.', resultCapabilities: ['cohort', 'market'], sourceClocks: ['HMDA period'] },
  insurance: { supportedEntityClasses: ['agency', 'producer', 'legal_insurer'], identifiers: ['NPN', 'NAIC'], nameSearchModes: ['normalized'], geographyLevels: ['state'], geographySemantics: 'Credential jurisdiction; address is not service territory.', filters: ['entity_class', 'jurisdiction'], publicationSemantics: 'Entity classes and publication gates remain separate.', resultCapabilities: ['identity', 'count'], sourceClocks: ['state DOI retrieved_at', 'OIR period'] },
  contractor: { supportedEntityClasses: ['credential'], identifiers: ['state_license'], nameSearchModes: ['canonical', 'normalized'], geographyLevels: ['state', 'county'], geographySemantics: 'Credential mailing/base county; never service territory.', filters: ['trade', 'credential_status', 'recorded_county'], publicationSemantics: 'Only specialist-published contractor profiles are public profiles.', resultCapabilities: ['identity', 'cohort'], sourceClocks: ['board official_as_of'] },
  senior: { supportedEntityClasses: ['nursing_home', 'home_health', 'hospice'], identifiers: ['CMS_CCN'], nameSearchModes: ['canonical', 'normalized'], geographyLevels: ['national', 'state', 'city'], geographySemantics: 'Provider address/office geography; not service area.', filters: ['provider_class', 'state', 'city'], publicationSemantics: 'CMS classes and specialist publication gates remain separate.', resultCapabilities: ['identity', 'cohort', 'evidence'], sourceClocks: ['CMS official_as_of'] },
  investor: { supportedEntityClasses: ['RIA', 'ERA'], identifiers: ['CRD', 'SEC_file_number'], nameSearchModes: ['canonical', 'normalized'], geographyLevels: ['national', 'state'], geographySemantics: 'Principal office; never client geography.', filters: ['firm_type', 'principal_office_state', 'RAUM'], publicationSemantics: 'Research identity is not a published firm report.', resultCapabilities: ['identity', 'cohort', 'evidence'], sourceClocks: ['IARD filing period'] },
};

export const HUB_CAPABILITY_CONTRACTS = Object.fromEntries(SPECIALIST_HUB_IDS.map((hubId) => [hubId, { hubId, ...DETAILS[hubId], canonicalDestination: HUB_CAPABILITY_REGISTRY[hubId].structuredAskUrl ?? HUB_CAPABILITY_REGISTRY[hubId].publicSearchUrl ?? HUB_CAPABILITY_REGISTRY[hubId].origin }])) as Record<SpecialistHubId, HubCapabilityContract>;

