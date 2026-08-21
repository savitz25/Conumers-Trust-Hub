/**
 * Academic Research Program — typed contracts.
 * No fake DOIs, downloads, or university affiliations.
 */

import type { SpecialistHubId } from '@/lib/network/registry';

export type AcademicVertical = SpecialistHubId | 'cross-network';

export type AcademicReleaseStatus =
  | 'PLANNED'
  | 'DOCUMENTATION'
  | 'REVIEW'
  | 'PUBLIC'
  | 'CONTROLLED'
  | 'ARCHIVED';

export type AcademicAccessLevel = 'OPEN' | 'CONTROLLED' | 'INTERNAL_RESEARCH';

export type AcademicPiiStatus = 'NONE_INTENDED' | 'STRIPPED' | 'NOT_APPLICABLE';

export type AcademicBusinessIdentificationPolicy =
  | 'NAMED_PUBLIC_ENTITIES'
  | 'DEIDENTIFIED_WHEN_RELEASED'
  | 'UNDECIDED_COUNSEL_REVIEW';

export type AcademicLicenseStatus = 'UNASSIGNED' | 'PENDING_COUNSEL' | 'ASSIGNED';

export type AcademicCitationStatus = 'TEMPLATE_ONLY' | 'READY' | 'DOI_ASSIGNED';

export type AcademicDatasetFormat = 'CSV' | 'JSON' | 'PARQUET' | 'MIXED' | 'UNSPECIFIED';

/** Public-facing identifier families used in TrustHub research (not invented IDs). */
export type AcademicCanonicalIdentifier =
  | 'usdot'
  | 'mc_number'
  | 'nmls'
  | 'cms_ccn'
  | 'crd'
  | 'sec_file_number'
  | 'state_license'
  | 'naic'
  | 'composite'
  | 'undetermined';

export type AcademicCanonicalEntityType =
  | 'household_goods_carrier'
  | 'mortgage_company'
  | 'insurance_agency'
  | 'licensed_contractor'
  | 'nursing_facility'
  | 'investment_adviser_firm'
  | 'business_entity'
  | 'cross_vertical';

export type AcademicTrack = 'data-science-ai' | 'public-policy-consumer-protection';

export type AcademicTrackExpansion =
  | 'gerontology'
  | 'consumer-law'
  | 'finance'
  | 'insurance'
  | 'construction-management';

export type AcademicProjectLevel =
  | 'undergraduate'
  | 'masters'
  | 'capstone'
  | 'independent-study';

export type AcademicEngagementTier = 0 | 1 | 2 | 3;

export type AcademicEngagementAvailability = 'open-when-released' | 'planned' | 'not-currently-open';

export interface AcademicCoverageNote {
  geography: string;
  timeRange: string;
  completeness: string;
}

export interface AcademicResearchDataset {
  id: string;
  title: string;
  vertical: AcademicVertical;
  description: string;
  researchUseCases: readonly string[];
  sourceAuthorities: readonly string[];
  canonicalEntityType: AcademicCanonicalEntityType;
  canonicalIdentifier: AcademicCanonicalIdentifier;
  coverage: AcademicCoverageNote;
  /** ISO date when a snapshot exists. Null until a release exists. */
  snapshotDate: string | null;
  version: string | null;
  format: AcademicDatasetFormat;
  accessLevel: AcademicAccessLevel;
  releaseStatus: AcademicReleaseStatus;
  piiStatus: AcademicPiiStatus;
  businessIdentificationPolicy: AcademicBusinessIdentificationPolicy;
  licenseStatus: AcademicLicenseStatus;
  citationStatus: AcademicCitationStatus;
  /** Only set after a real DOI is registered. Never invent. */
  doi: string | null;
  documentationHref: string | null;
  downloadHref: string | null;
  limitations: readonly string[];
  lastReviewedAt: string;
}

export interface AcademicProjectBrief {
  id: string;
  title: string;
  academicTrack: AcademicTrack;
  recommendedLevel: AcademicProjectLevel;
  verticals: readonly AcademicVertical[];
  researchQuestion: string;
  whyItMatters: string;
  possibleDatasetIds: readonly string[];
  suggestedMethods: readonly string[];
  expectedDifficulty: 'moderate' | 'substantial' | 'advanced';
  privacyLegalConsiderations: readonly string[];
  potentialOutput: string;
  irbLikely: boolean;
}

export interface AcademicEngagementTierDef {
  tier: AcademicEngagementTier;
  name: string;
  summary: string;
  availability: AcademicEngagementAvailability;
}

export interface AcademicIndependencePrinciple {
  id: string;
  title: string;
  body: string;
}
