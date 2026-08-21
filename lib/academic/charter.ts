import type { AcademicIndependencePrinciple } from './types';

export const ACADEMIC_PROGRAM_NAME = 'TrustHub Academic Research Program';

export const ACADEMIC_PROGRAM_STATUS_BADGE = 'Program foundation · Preparing 2027 pilot projects';

export const ACADEMIC_INDEPENDENCE_CHARTER: readonly AcademicIndependencePrinciple[] = [
  {
    id: 'unfavorable-findings',
    title: 'Unfavorable findings are allowed',
    body: 'Researchers are free to reach conclusions that are unfavorable to TrustHub, to a specialist hub, or to businesses represented in public records.',
  },
  {
    id: 'no-favorable-requirement',
    title: 'No requirement of favorable conclusions',
    body: 'TrustHub does not require, incentivize, or condition access on favorable conclusions about the network, its methodology, or any listed entity.',
  },
  {
    id: 'factual-correction-only',
    title: 'Factual correction, not suppression',
    body: 'TrustHub may correct factual errors about an underlying dataset or explain source limitations. It must not suppress findings because they are unfavorable.',
  },
  {
    id: 'methodology-weaknesses',
    title: 'Methodology critique is a feature',
    body: 'Findings that expose weaknesses in TrustHub methodology should be treated as opportunities to improve the system, not as reputational incidents to bury.',
  },
  {
    id: 'no-consumer-pii',
    title: 'No consumer PII',
    body: 'The academic program does not provide consumer personally identifiable information. Releases must be designed so that consumer PII is not included.',
  },
  {
    id: 'document-limitations',
    title: 'Limitations must be documented',
    body: 'Dataset limitations, missing evidence, uneven state coverage, and overwrite risk in source systems must be documented alongside any future release.',
  },
  {
    id: 'source-attribution',
    title: 'Original sources remain the authority',
    body: 'Public regulatory data should remain attributable to its original source. TrustHub organization of records is not a substitute for the underlying registry.',
  },
  {
    id: 'analysis-independence',
    title: 'Researchers retain analytical independence',
    body: 'Academic researchers retain independence over their questions, methods, interpretation, and publication decisions.',
  },
  {
    id: 'review-not-approval',
    title: 'Review is not editorial approval',
    body: 'Future collaboration agreements may allow a limited factual or legal review period before publication. Review is never approval based on favorability of findings.',
  },
  {
    id: 'public-methodology-changes',
    title: 'Documented methodology changes',
    body: 'When independent research leads to a meaningful change in TrustHub methodology, TrustHub should publicly document that change when appropriate.',
  },
] as const;
