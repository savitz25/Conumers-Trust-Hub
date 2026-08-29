/**
 * Coverage Atlas — schema only for Prompt 1.
 * No numeric research-depth score. Cells must be explainable categories.
 */
export type CoverageAtlasCell = {
  hubId: string;
  geographyType: 'national' | 'state' | 'county' | 'local';
  geographyCode: string;
  status:
    | 'federal_core'
    | 'basic_discovery'
    | 'state_research'
    | 'enhanced_state_intelligence'
    | 'enhanced_county_intelligence'
    | 'not_yet_researched';
  why: string;
};

export const COVERAGE_ATLAS_VERSION = 'coverage-atlas-schema-v1';
