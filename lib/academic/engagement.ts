import type { AcademicEngagementTierDef, AcademicTrack, AcademicTrackExpansion } from './types';

export const ACADEMIC_PRIMARY_TRACKS: readonly {
  id: AcademicTrack;
  name: string;
  summary: string;
}[] = [
  {
    id: 'data-science-ai',
    name: 'Data science / AI',
    summary:
      'Entity resolution, missing-data bias, calibration, longitudinal snapshots, and measurement of matching systems against public business identity records.',
  },
  {
    id: 'public-policy-consumer-protection',
    name: 'Public policy / consumer protection',
    summary:
      'How regulatory information is published, overwritten, or withheld across states and agencies — and whether that structure helps or hinders consumers.',
  },
] as const;

export const ACADEMIC_EXPANSION_TRACKS: readonly {
  id: AcademicTrackExpansion;
  name: string;
}[] = [
  { id: 'gerontology', name: 'Gerontology' },
  { id: 'consumer-law', name: 'Consumer law' },
  { id: 'finance', name: 'Finance' },
  { id: 'insurance', name: 'Insurance' },
  { id: 'construction-management', name: 'Construction management' },
] as const;

export const ACADEMIC_ENGAGEMENT_TIERS: readonly AcademicEngagementTierDef[] = [
  {
    tier: 0,
    name: 'Open research',
    summary:
      'Versioned public research datasets, documentation, methodology notes, and citation information where legally and operationally appropriate. Nothing in this catalog is a public download yet.',
    availability: 'planned',
  },
  {
    tier: 1,
    name: 'Classroom research',
    summary:
      'Turnkey project materials suitable for classroom assignments, independent study, or research-methods courses once datasets and documentation are released.',
    availability: 'planned',
  },
  {
    tier: 2,
    name: 'Capstone / practicum',
    summary:
      'A defined real-world research problem, documented dataset, and limited TrustHub support for a student team. Coordinators — not cold outreach to individual faculty — are the preferred first audience.',
    availability: 'planned',
  },
  {
    tier: 3,
    name: 'Funded research',
    summary:
      'A future possibility only. TrustHub is not soliciting funded proposals, creating payment systems, or promising grants in this foundation.',
    availability: 'not-currently-open',
  },
] as const;

export const ACADEMIC_PREFERRED_AUDIENCES = [
  'University capstone and practicum coordinators',
  'Interdisciplinary centers and research institutes',
  'Selected data science / AI faculty (after coordinator pathways exist)',
  'Selected public policy / consumer-protection faculty (after coordinator pathways exist)',
  'Later academic disciplines listed as expansion tracks',
] as const;

export const ACADEMIC_DEFERRED_OUTREACH = [
  'University datathons',
  'Data competitions',
  'Guest lectures',
  'Classroom research projects at scale',
  'Cold-emailing individual professors as the primary strategy',
] as const;

export const ACADEMIC_SUCCESS_METRICS = [
  {
    id: 'citable-outputs',
    label: 'Completed citable research outputs',
    why: 'The program exists to produce independent analysis, not partnership announcements.',
  },
  {
    id: 'dataset-citations',
    label: 'Academic dataset citations',
    why: 'Citation of versioned releases is a better signal than logo placement.',
  },
  {
    id: 'doi-citations',
    label: 'DOI citations (when DOIs exist)',
    why: 'Formal identifiers support replication and archival credit. None are assigned yet.',
  },
  {
    id: 'downloads',
    label: 'Dataset downloads where appropriate',
    why: 'Use only after an open release exists; do not treat unpublished catalogs as usage.',
  },
  {
    id: 'returning-faculty',
    label: 'Returning faculty and programs',
    why: 'Repeat use indicates research utility, not a one-time courtesy listing.',
  },
  {
    id: 'methodology-improvements',
    label: 'Methodology improvements triggered by outside research',
    why: 'Unfavorable findings that change TrustHub practice are a success, not a failure.',
  },
  {
    id: 'replications',
    label: 'Replicated analyses',
    why: 'Independent reproduction is stronger than a single flattering paper.',
  },
  {
    id: 'recruiting',
    label: 'Student recruiting outcomes',
    why: 'Secondary: whether graduates who used the materials become stronger researchers.',
  },
  {
    id: 'external-references',
    label: 'High-quality external references',
    why: 'Researchers, regulators, or journalists citing the work for its substance.',
  },
] as const;
