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

export type EvidenceAtlasCell = {
  hubId: string;
  familyId: EvidenceFamilyId;
  status: 'deep' | 'available' | 'partial' | 'planned' | 'not_applicable';
  why: string;
};

export const EVIDENCE_ATLAS_VERSION = 'evidence-atlas-schema-v1';
