/**
 * Evidence Atlas — schema only for Prompt 1.
 * Status is categorical. Do not publish arbitrary percentages.
 */
export const EVIDENCE_FAMILY_IDS = [
  'identity',
  'credential',
  'licensing',
  'registration',
  'ownership',
  'market_activity',
  'complaints',
  'enforcement',
  'inspection',
  'staffing_quality',
  'compensation',
  'pricing',
  'permits',
  'local_regulatory',
] as const;

export type EvidenceFamilyId = (typeof EVIDENCE_FAMILY_IDS)[number];

export type EvidenceStatus = 'deep' | 'available' | 'partial' | 'planned' | 'not_applicable';

export type EvidenceAtlasCell = {
  hubId: string;
  familyId: EvidenceFamilyId;
  status: EvidenceStatus;
  why: string;
  destination?: string;
  sourceFamilyId?: string;
};

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  deep: 'Deep',
  available: 'Available',
  partial: 'Partial',
  planned: 'Planned',
  not_applicable: 'Not applicable',
};

export const EVIDENCE_FAMILY_LABELS: Record<EvidenceFamilyId, string> = {
  identity: 'Identity',
  credential: 'Licensing / credential',
  licensing: 'License / authority class',
  registration: 'Registration',
  ownership: 'Ownership',
  market_activity: 'Market activity',
  complaints: 'Complaints',
  enforcement: 'Enforcement',
  inspection: 'Inspections',
  staffing_quality: 'Staffing / quality',
  compensation: 'Compensation',
  pricing: 'Pricing',
  permits: 'Permits',
  local_regulatory: 'Local regulatory evidence',
};

export const EVIDENCE_ATLAS_VERSION = 'evidence-atlas-schema-v1';
