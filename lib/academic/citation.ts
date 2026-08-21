/**
 * Citation / DOI readiness. No DOIs are registered in Academic 001A.
 */

export const ACADEMIC_CITATION_TEMPLATE =
  'TrustHub Research Data. [Dataset Title]. Version [X]. [Release date]. DOI: [when assigned].';

export const ACADEMIC_CITATION_NOTES = [
  'Do not invent a DOI. Leave the DOI field blank until a repository assigns one.',
  'Version and release date refer to an immutable snapshot, not a live production extract.',
  'Cite the original regulator (FMCSA, NMLS, CMS, SEC, state boards, DOI/NAIC) as the source of the underlying records.',
  'TrustHub citation covers the organized snapshot, schema, and documentation — not ownership of the public records.',
] as const;

export const ACADEMIC_DOI_CANDIDATE_REPOSITORIES = [
  {
    name: 'Zenodo',
    href: 'https://zenodo.org/',
    note: 'Possible later archive. Not registered for TrustHub datasets in this foundation.',
  },
  {
    name: 'Harvard Dataverse',
    href: 'https://dataverse.harvard.edu/',
    note: 'Possible later archive. Not registered for TrustHub datasets in this foundation.',
  },
] as const;

export function formatAcademicCitationDraft(input: {
  title: string;
  version: string | null;
  releaseDate: string | null;
  doi: string | null;
}): string {
  const version = input.version ?? '[version unassigned]';
  const release = input.releaseDate ?? '[release date unassigned]';
  const doi = input.doi ?? '[DOI when assigned]';
  return `TrustHub Research Data. ${input.title}. Version ${version}. ${release}. DOI: ${doi}.`;
}
