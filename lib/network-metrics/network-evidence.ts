import type { LoadedSpecialistContract, MetricOrigin } from './types.ts';
import type { SpecialistHubId } from './sources.ts';

export const ASK_PUBLICATION_STATUSES = [
  'PUBLIC',
  'PUBLIC_PARTIAL',
  'PUBLIC_UNKNOWN',
  'PUBLIC_RESEARCH_GRAPH',
] as const;

export type AskPublicationStatus = (typeof ASK_PUBLICATION_STATUSES)[number];
export type NetworkEvidenceFamily =
  | 'IDENTITY_CREDENTIALS'
  | 'AUTHORITY_REGISTRATION'
  | 'REGULATORY_ENFORCEMENT'
  | 'COMPLAINTS_OBSERVATIONS'
  | 'INSPECTIONS_EXAMS_DEFICIENCIES'
  | 'MARKET_ACTIVITY'
  | 'OWNERSHIP_RELATIONSHIPS'
  | 'STAFFING_OPERATIONS'
  | 'PERMITS_WORK_PROPERTY'
  | 'FILINGS_FORM_ADV'
  | 'PUBLIC_RESEARCH_SURFACES'
  | 'SOURCE_PROVENANCE';

export const NETWORK_EVIDENCE_FAMILY_LABELS: Record<NetworkEvidenceFamily, string> = {
  IDENTITY_CREDENTIALS: 'Identity & credentials',
  AUTHORITY_REGISTRATION: 'Authority, licensing & registration',
  REGULATORY_ENFORCEMENT: 'Regulatory & enforcement evidence',
  COMPLAINTS_OBSERVATIONS: 'Complaints & consumer observations',
  INSPECTIONS_EXAMS_DEFICIENCIES: 'Inspections, examinations & deficiencies',
  MARKET_ACTIVITY: 'Market & activity evidence',
  OWNERSHIP_RELATIONSHIPS: 'Ownership, control & relationships',
  STAFFING_OPERATIONS: 'Staffing & operational evidence',
  PERMITS_WORK_PROPERTY: 'Permits, work & property evidence',
  FILINGS_FORM_ADV: 'Filings & Form ADV evidence',
  PUBLIC_RESEARCH_SURFACES: 'Public research surfaces',
  SOURCE_PROVENANCE: 'Source, provenance & freshness',
};

export type AskNetworkEvidenceMeasure = {
  hub: SpecialistHubId;
  key: string;
  label: string;
  value: number | null;
  valueState: string;
  publicationStatus: AskPublicationStatus;
  family: NetworkEvidenceFamily;
  grain: string;
  entityClass: string;
  coverage: string;
  sourceSystems: string[];
  sourceAsOf: string | null;
  retrievedAt: string | null;
  snapshotAsOf: string | null;
  generatedAt: string;
  definition: string;
  counts: string;
  doesNotCount: string;
  destination: string;
  limitation: string;
  origin: MetricOrigin;
  specialistSchema: string;
  specialistFingerprint: string;
};

type RawMetric = Record<string, unknown>;

const HUB_DESTINATIONS: Record<SpecialistHubId, string> = {
  move: 'https://www.movetrusthub.com',
  lender: 'https://www.lendertrusthub.com',
  insurance: 'https://www.insurancetrusthub.com',
  contractor: 'https://www.contractortrusthub.com',
  senior: 'https://www.seniortrusthub.com',
  investor: 'https://www.investortrusthub.com',
};

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function traceText(metric: RawMetric, keys: string[]): string | null {
  const trace = metric.trace && typeof metric.trace === 'object' ? metric.trace as Record<string, unknown> : {};
  for (const key of keys) {
    const value = text(trace[key]);
    if (value) return value;
  }
  return null;
}

function familyFor(metric: RawMetric): NetworkEvidenceFamily {
  const words = `${metric.key ?? ''} ${metric.grain ?? ''} ${metric.label ?? ''}`.toLowerCase();
  if (/published.*(page|surface)|research.*(page|surface)|indexable.*profile/.test(words)) return 'PUBLIC_RESEARCH_SURFACES';
  if (/form_adv|filing|withdrawal|item_11|successor/.test(words)) return 'FILINGS_FORM_ADV';
  if (/permit|construction|work_history|property/.test(words)) return 'PERMITS_WORK_PROPERTY';
  if (/staff|pbj|mds|operat/.test(words)) return 'STAFFING_OPERATIONS';
  if (/owner|control|appoint|associated|relationship|qualif/.test(words)) return 'OWNERSHIP_RELATIONSHIPS';
  if (/inspection|deficien|citation|exam|fire/.test(words)) return 'INSPECTIONS_EXAMS_DEFICIENCIES';
  if (/complaint|experience|imr/.test(words)) return 'COMPLAINTS_OBSERVATIONS';
  if (/enforcement|disciplin|regulatory|unlicensed|recovery|stop.work|debar/.test(words)) return 'REGULATORY_ENFORCEMENT';
  if (/hmda|originat|denial|application|market|rate|quality|raum|loan|program/.test(words)) return 'MARKET_ACTIVITY';
  if (/license|credential|authority|registration|active|current|loa|certificate/.test(words)) return 'AUTHORITY_REGISTRATION';
  if (/identity|firm|provider|agency|insurer|producer|carrier|broker|institution|contact|address|directory/.test(words)) return 'IDENTITY_CREDENTIALS';
  return 'SOURCE_PROVENANCE';
}

export function buildAskNetworkEvidenceInventory(
  contracts: Record<SpecialistHubId, LoadedSpecialistContract>,
): AskNetworkEvidenceMeasure[] {
  const allowed = new Set<string>(ASK_PUBLICATION_STATUSES);
  return (Object.values(contracts) as LoadedSpecialistContract[]).flatMap((contract) => {
    const metrics = Array.isArray(contract.raw.metrics) ? contract.raw.metrics as RawMetric[] : [];
    return metrics.filter((metric) => allowed.has(String(metric.publicationStatus))).map((metric) => {
      const publicationStatus = String(metric.publicationStatus) as AskPublicationStatus;
      const value = typeof metric.value === 'number' && Number.isFinite(metric.value) ? metric.value : null;
      if (publicationStatus === 'PUBLIC' && value === null) {
        throw new Error(`${contract.hub}:${String(metric.key)} PUBLIC metric must have a numeric value`);
      }
      const sourceSystems = Array.isArray(metric.contributingSourceSystems)
        ? metric.contributingSourceSystems.map(String)
        : [];
      return {
        hub: contract.hub,
        key: String(metric.key),
        label: String(metric.label),
        value,
        valueState: text(metric.valueState) ?? (value === null ? 'UNKNOWN' : 'KNOWN'),
        publicationStatus,
        family: familyFor(metric),
        grain: String(metric.grain),
        entityClass: text(metric.providerClass) ?? text(metric.entityClass) ?? String(metric.grain),
        coverage: typeof metric.coverage === 'string' ? metric.coverage : 'See specialist trace',
        sourceSystems,
        sourceAsOf: text(metric.sourceAsOf),
        retrievedAt: text(metric.retrievedAt),
        snapshotAsOf: text(metric.snapshotAsOf),
        generatedAt: text(metric.generatedAt) ?? String(contract.raw.generatedAt),
        definition: text(metric.description) ?? String(metric.label),
        counts: traceText(metric, ['counts', 'method']) ?? text(metric.description) ?? String(metric.label),
        doesNotCount: traceText(metric, ['doesNotCount']) ?? 'No additional denominator is implied.',
        destination: HUB_DESTINATIONS[contract.hub],
        limitation: traceText(metric, ['limitations']) ?? text(metric.denominator) ?? 'See the specialist source contract.',
        origin: contract.origin,
        specialistSchema: String(contract.raw.schemaVersion),
        specialistFingerprint: String(contract.raw.sourceFingerprint),
      };
    });
  });
}

export const ASK_NETWORK_STATES = [
  { code: 'FL', slug: 'florida', name: 'Florida' },
  { code: 'NJ', slug: 'new-jersey', name: 'New Jersey' },
  { code: 'CA', slug: 'california', name: 'California' },
  { code: 'TX', slug: 'texas', name: 'Texas' },
  { code: 'WA', slug: 'washington', name: 'Washington' },
  { code: 'AZ', slug: 'arizona', name: 'Arizona' },
] as const;

const ADAPTER_PATHS: Partial<Record<SpecialistHubId, string[]>> = {
  contractor: ['/florida', '/new-jersey', '/california', '/texas', '/washington', '/arizona'],
  senior: ['/florida', '/new-jersey', '/california', '/texas', '/washington', '/arizona'],
};

function specialistPaths(contract: LoadedSpecialistContract): string[] {
  const raw = contract.raw;
  const network = raw.network && typeof raw.network === 'object' ? raw.network as Record<string, unknown> : {};
  const publication = raw.publication && typeof raw.publication === 'object' ? raw.publication as Record<string, unknown> : {};
  const paths = network.publishedStateIntelligencePaths ?? raw.publishedStateIntelligencePaths ?? publication.publishedStateIntelligencePaths ?? ADAPTER_PATHS[contract.hub];
  return Array.isArray(paths) ? paths.map(String) : [];
}

export type StateCoverageMode = 'SPECIALIST_PUBLISHED' | 'NATIONAL_ONLY' | 'NO_COMPARABLE_STATE_UNIVERSE';

export function buildAskStateCoverage(contracts: Record<SpecialistHubId, LoadedSpecialistContract>) {
  return ASK_NETWORK_STATES.map((state) => ({
    ...state,
    askHref: `/${state.slug}`,
    hubs: (Object.values(contracts) as LoadedSpecialistContract[]).map((contract) => {
      const path = `/${state.slug}`;
      const published = specialistPaths(contract).includes(path);
      const noComparable = contract.hub === 'move' && state.code === 'AZ';
      const mode: StateCoverageMode = published
        ? 'SPECIALIST_PUBLISHED'
        : noComparable
          ? 'NO_COMPARABLE_STATE_UNIVERSE'
          : 'NATIONAL_ONLY';
      return {
        hub: contract.hub,
        mode,
        href: published ? `${HUB_DESTINATIONS[contract.hub]}${path}` : HUB_DESTINATIONS[contract.hub],
        label: published
          ? 'Specialist state intelligence'
          : noComparable
            ? 'No comparable state HHG licensing universe'
            : 'National research / verification path',
      };
    }),
  }));
}
