import type { AcademicResearchDataset } from './types';

const REVIEWED = '2026-08-10';

const COMMON_LIMITATIONS = [
  'No public academic snapshot has been released. This catalog entry is prospective.',
  'Coverage and fields must follow what the specialist hub actually demonstrates — not an idealized schema.',
  'Source registries frequently overwrite prior state; a future snapshot is not a live feed.',
  'Consumer PII is not part of the academic program.',
] as const;

/**
 * Prospective research-dataset registry.
 * releaseStatus is PLANNED or DOCUMENTATION only until a real snapshot exists.
 * downloadHref and doi stay null.
 */
export const ACADEMIC_DATASETS: readonly AcademicResearchDataset[] = [
  {
    id: 'move-regulatory-identity',
    title: 'Mover regulatory identity and authority (prospective)',
    vertical: 'move',
    description:
      'Organized public FMCSA/SAFER-oriented identity for household-goods movers: operating authority context, broker/carrier classification where published, and enforcement or fitness history that Move Trust Hub already treats as research evidence.',
    researchUseCases: [
      'Entity resolution across USDOT / MC identifiers',
      'Enforcement history versus later public complaint patterns',
      'Broker versus carrier classification studies',
    ],
    sourceAuthorities: ['FMCSA', 'SAFER'],
    canonicalEntityType: 'household_goods_carrier',
    canonicalIdentifier: 'usdot',
    coverage: {
      geography: 'U.S. interstate household-goods movers in public FMCSA systems (as used on Move Trust Hub)',
      timeRange: 'Not snapshot-dated until a versioned academic release exists',
      completeness: 'Limited to fields Move Trust Hub actually uses; not a complete FMCSA dump',
    },
    snapshotDate: null,
    version: null,
    format: 'UNSPECIFIED',
    accessLevel: 'INTERNAL_RESEARCH',
    releaseStatus: 'PLANNED',
    piiStatus: 'NONE_INTENDED',
    businessIdentificationPolicy: 'UNDECIDED_COUNSEL_REVIEW',
    licenseStatus: 'PENDING_COUNSEL',
    citationStatus: 'TEMPLATE_ONLY',
    doi: null,
    documentationHref: '/academic#datasets',
    downloadHref: null,
    limitations: [
      ...COMMON_LIMITATIONS,
      'Intrastate-only movers and state licensing overlays are incomplete relative to interstate FMCSA records.',
    ],
    lastReviewedAt: REVIEWED,
  },
  {
    id: 'senior-cms-facility',
    title: 'Nursing-facility CMS records and ownership context (prospective)',
    vertical: 'senior',
    description:
      'CMS-oriented nursing-facility identity, ownership relationships where CMS publishes them, and inspection or enforcement history that SeniorTrustHub already treats as government-sourced research — not placement inventory.',
    researchUseCases: [
      'Ownership networks and regulatory outcomes',
      'Inspection history versus public quality measures',
      'State overlay comparison where supported',
    ],
    sourceAuthorities: ['CMS', 'Supported state regulators'],
    canonicalEntityType: 'nursing_facility',
    canonicalIdentifier: 'cms_ccn',
    coverage: {
      geography: 'CMS-published nursing facilities; state overlays only where SeniorTrustHub already supports them',
      timeRange: 'Not snapshot-dated until a versioned academic release exists',
      completeness: 'Do not assume national completeness of every state senior-care regulator',
    },
    snapshotDate: null,
    version: null,
    format: 'UNSPECIFIED',
    accessLevel: 'INTERNAL_RESEARCH',
    releaseStatus: 'DOCUMENTATION',
    piiStatus: 'NONE_INTENDED',
    businessIdentificationPolicy: 'UNDECIDED_COUNSEL_REVIEW',
    licenseStatus: 'PENDING_COUNSEL',
    citationStatus: 'TEMPLATE_ONLY',
    doi: null,
    documentationHref: '/academic#datasets',
    downloadHref: null,
    limitations: [
      ...COMMON_LIMITATIONS,
      'Assisted-living identity is only in scope where the hub already supports it. CMS nursing-home data is not a national AL registry.',
      'SeniorTrustHub is research infrastructure, not a referral marketplace; academic extracts must not be framed as placement lists.',
      'A 2026-08-21 live warehouse recount, Open V1 freeze, and internal reproducibility dry-run exist (docs/academic/senior-v1/, docs/ACADEMIC-001B2B-SENIOR-OPEN-V1-REPRODUCIBILITY.md). No public files, download, or DOI. snapshotDate remains unset until a published extract exists.',
    ],
    lastReviewedAt: '2026-08-21',
  },
  {
    id: 'contractor-state-license',
    title: 'State contractor-license records and multi-state identity (prospective)',
    vertical: 'contractor',
    description:
      'Official-board contractor license and registration identity with state-specific depth, including disciplinary evidence where a board already publishes it on Contractor Trust Hub.',
    researchUseCases: [
      'Multi-state licensing structure',
      'Regulatory entity resolution across boards',
      'Uneven public access to discipline records',
    ],
    sourceAuthorities: ['State contractor licensing boards'],
    canonicalEntityType: 'licensed_contractor',
    canonicalIdentifier: 'state_license',
    coverage: {
      geography: 'States with demonstrated official-board evidence on Contractor Trust Hub — not identical national coverage',
      timeRange: 'Not snapshot-dated until a versioned academic release exists',
      completeness: 'State-specific depth; missing records do not mean a clean history',
    },
    snapshotDate: null,
    version: null,
    format: 'UNSPECIFIED',
    accessLevel: 'INTERNAL_RESEARCH',
    releaseStatus: 'PLANNED',
    piiStatus: 'NONE_INTENDED',
    businessIdentificationPolicy: 'UNDECIDED_COUNSEL_REVIEW',
    licenseStatus: 'PENDING_COUNSEL',
    citationStatus: 'TEMPLATE_ONLY',
    doi: null,
    documentationHref: '/academic#datasets',
    downloadHref: null,
    limitations: [
      ...COMMON_LIMITATIONS,
      'Do not hard-code a state count. Evidence depth differs by jurisdiction.',
    ],
    lastReviewedAt: REVIEWED,
  },
  {
    id: 'investor-sec-iard-firm',
    title: 'SEC / IARD investment-adviser firm records (prospective)',
    vertical: 'investor',
    description:
      'Firm-level SEC/IARD registration identity as used on InvestorTrustHub. This is not a FINRA BrokerCheck people product, stock-advice dataset, or complete advisor-profile dump.',
    researchUseCases: [
      'Firm registration status research',
      'Regulatory identity matching on CRD / SEC file numbers',
      'Limits of public Form ADV as consumer information',
    ],
    sourceAuthorities: ['SEC', 'IARD'],
    canonicalEntityType: 'investment_adviser_firm',
    canonicalIdentifier: 'crd',
    coverage: {
      geography: 'U.S. investment adviser firms in IARD / Form ADV as used on InvestorTrustHub',
      timeRange: 'Not snapshot-dated until a versioned academic release exists',
      completeness: 'Firm filings only — not all brokers, not people-level BrokerCheck',
    },
    snapshotDate: null,
    version: null,
    format: 'UNSPECIFIED',
    accessLevel: 'INTERNAL_RESEARCH',
    releaseStatus: 'PLANNED',
    piiStatus: 'NONE_INTENDED',
    businessIdentificationPolicy: 'UNDECIDED_COUNSEL_REVIEW',
    licenseStatus: 'PENDING_COUNSEL',
    citationStatus: 'TEMPLATE_ONLY',
    doi: null,
    documentationHref: '/academic#datasets',
    downloadHref: null,
    limitations: [
      ...COMMON_LIMITATIONS,
      'SEC “Approved” on a filing is not SEC endorsement of the firm.',
      'People-level broker records are out of scope for this catalog entry.',
    ],
    lastReviewedAt: REVIEWED,
  },
  {
    id: 'insurance-agency-identity',
    title: 'Insurance agency / producer regulatory identity (prospective)',
    vertical: 'insurance',
    description:
      'State DOI / NAIC-oriented identity for insurance agencies and producers where Insurance Trust Hub already organizes public license context. Coverage is not a single national producer database.',
    researchUseCases: [
      'State-by-state license transparency',
      'Agency identity resolution across DOI systems',
      'Limits of NAIC as a coordinating layer versus the state of record',
    ],
    sourceAuthorities: ['State Departments of Insurance', 'NAIC'],
    canonicalEntityType: 'insurance_agency',
    canonicalIdentifier: 'naic',
    coverage: {
      geography: 'State DOI systems as used on Insurance Trust Hub; completeness varies by state',
      timeRange: 'Not snapshot-dated until a versioned academic release exists',
      completeness: 'Not a national producer license file; NAIC does not replace the state DOI',
    },
    snapshotDate: null,
    version: null,
    format: 'UNSPECIFIED',
    accessLevel: 'INTERNAL_RESEARCH',
    releaseStatus: 'PLANNED',
    piiStatus: 'NONE_INTENDED',
    businessIdentificationPolicy: 'UNDECIDED_COUNSEL_REVIEW',
    licenseStatus: 'PENDING_COUNSEL',
    citationStatus: 'TEMPLATE_ONLY',
    doi: null,
    documentationHref: '/academic#datasets',
    downloadHref: null,
    limitations: [
      ...COMMON_LIMITATIONS,
      'License status does not prove claim-service quality.',
      'State publication of discipline and complaints is uneven.',
    ],
    lastReviewedAt: REVIEWED,
  },
  {
    id: 'lender-nmls-company',
    title: 'Mortgage-company NMLS-oriented public identity (prospective)',
    vertical: 'lender',
    description:
      'Company-level NMLS Consumer Access identity and related public records (CFPB complaint patterns, FDIC/bank identity where relevant) as Lender Trust Hub already uses them for research — not a lead list and not a universal Trust Score dump.',
    researchUseCases: [
      'Company NMLS identity resolution',
      'Public complaint patterns versus license status',
      'Bank versus non-bank identity in public records',
    ],
    sourceAuthorities: ['NMLS Consumer Access', 'CFPB', 'FDIC / public banking records'],
    canonicalEntityType: 'mortgage_company',
    canonicalIdentifier: 'nmls',
    coverage: {
      geography: 'U.S. mortgage companies appearing in NMLS-oriented Lender Trust Hub research',
      timeRange: 'Not snapshot-dated until a versioned academic release exists',
      completeness: 'Company-oriented public fields only; not loan-level HMDA microdata in this catalog entry',
    },
    snapshotDate: null,
    version: null,
    format: 'UNSPECIFIED',
    accessLevel: 'INTERNAL_RESEARCH',
    releaseStatus: 'PLANNED',
    piiStatus: 'NONE_INTENDED',
    businessIdentificationPolicy: 'UNDECIDED_COUNSEL_REVIEW',
    licenseStatus: 'PENDING_COUNSEL',
    citationStatus: 'TEMPLATE_ONLY',
    doi: null,
    documentationHref: '/academic#datasets',
    downloadHref: null,
    limitations: [
      ...COMMON_LIMITATIONS,
      'Lender Trust Hub does not sell ranking placement. Academic extracts must not be treated as a ranked marketplace file.',
      'Complaint volume is a research signal, not a finding of wrongdoing.',
      'FCRA-adjacent uses of any future extract require counsel review before release.',
    ],
    lastReviewedAt: REVIEWED,
  },
] as const;

export function getAcademicDatasetById(id: string): AcademicResearchDataset | undefined {
  return ACADEMIC_DATASETS.find((d) => d.id === id);
}

export function academicReleaseLabel(status: AcademicResearchDataset['releaseStatus']): string {
  switch (status) {
    case 'PLANNED':
      return 'Planned — not released';
    case 'DOCUMENTATION':
      return 'Documentation in progress';
    case 'REVIEW':
      return 'Internal review';
    case 'PUBLIC':
      return 'Public snapshot';
    case 'CONTROLLED':
      return 'Controlled access';
    case 'ARCHIVED':
      return 'Archived snapshot';
    default:
      return status;
  }
}
