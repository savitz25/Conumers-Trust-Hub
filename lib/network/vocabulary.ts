/**
 * Shared AskTrustHub 2.0 vocabulary.
 * Unlike concepts stay unlike. Do not blur them in UI copy.
 */

export const NETWORK_VOCABULARY = {
  hub: {
    term: 'Hub',
    meaning: 'One specialist TrustHub research system (Move, Lender, Insurance, Contractor, Senior, or Investor).',
  },
  entity: {
    term: 'Entity',
    meaning:
      'A regulated person, organization, or provider identity where the underlying hub supports entity identity. Not every observation is an entity.',
  },
  credential: {
    term: 'Credential',
    meaning: 'A license, registration, authority, certification, or similar regulator-issued record.',
  },
  observation: {
    term: 'Observation',
    meaning: 'One source record or normalized research observation. Observations are not entities.',
  },
  sourceOrganization: {
    term: 'Source organization',
    meaning:
      'Organization that publishes or maintains source data. Not every source organization is a government agency.',
  },
  regulator: {
    term: 'Regulator / agency',
    meaning: 'A government authority responsible for regulation or oversight.',
  },
  sourceSystem: {
    term: 'Source system',
    meaning: 'Portal, publication, or system through which a dataset is published (for example SAFER or NMLS Consumer Access).',
  },
  sourceFamily: {
    term: 'Source family / dataset',
    meaning: 'A defined dataset or closely related family of public records.',
  },
  officialAsOf: {
    term: 'Official as-of',
    meaning: 'The period or date represented by the source itself. Not the retrieval time.',
  },
  retrieved: {
    term: 'Retrieved',
    meaning: 'When TrustHub obtained or refreshed the source. Not the official source period.',
  },
  snapshot: {
    term: 'Snapshot',
    meaning: 'A deterministic TrustHub research release or version.',
  },
  coverageCapability: {
    term: 'Coverage capability',
    meaning: 'A factual research capability currently supported for a geography or evidence family.',
  },
  geographyLevel: {
    term: 'Geography level',
    meaning: 'National, state, county, or local. Geography meaning differs by source family.',
  },
} as const;

export const NAME_IS_NOT_IDENTITY =
  'A shared display name does not mean two records are the same legal entity. Name appearance is not a confirmed identity match.';
