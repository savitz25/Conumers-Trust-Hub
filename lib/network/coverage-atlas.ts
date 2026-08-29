/**
 * Coverage Atlas — Prompt 2 user-facing matrix uses coverage-atlas-data.ts.
 * No numeric research-depth score. Cells must be explainable categories.
 */
export type CoverageLevel =
  | 'federal_core'
  | 'basic_discovery'
  | 'state_research'
  | 'enhanced_state_intelligence'
  | 'enhanced_county_intelligence'
  | 'not_yet_researched';

export type CoverageAtlasCell = {
  hubId: string;
  geographyType: 'national' | 'state' | 'county' | 'local';
  geographyCode: string;
  status: CoverageLevel;
  why: string;
  destination?: string;
  dedicatedPage?: boolean;
};

export const COVERAGE_ATLAS_VERSION = 'coverage-atlas-schema-v1';

export const COVERAGE_LEVEL_LABELS: Record<CoverageLevel, string> = {
  federal_core: 'Federal core',
  basic_discovery: 'Basic discovery',
  state_research: 'State research',
  enhanced_state_intelligence: 'Enhanced state intelligence',
  enhanced_county_intelligence: 'Enhanced county intelligence',
  not_yet_researched: 'Not yet researched',
};

export const COVERAGE_NOTIFY_CONTRACT = 'coverage-notify-v1';
