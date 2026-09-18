/**
 * TH-SEARCH-R1-019A deterministic integration fixture. HYPOTHETICAL TEST DATA ONLY.
 *
 * These records are not assertions that any such business exists in Production, are never written
 * to a data store, and can only be served when NAME_CANDIDATES_FIXTURE is set on a NON-production
 * deployment (see fixtureModeEnabled). Each fixture hub performs ITS OWN name matching over ITS OWN
 * records -- exactly like a real specialist -- so the parent orchestrator under test is the real one
 * and never matches names itself.
 */
import { SPECIALIST_HUB_IDS, CANONICAL_ORIGINS, type SpecialistHubId } from '../registry.ts';
import type { HubNameAdapter } from './adapters.ts';
import type { HubNameSearchOutcome, MatchMethod, NameCandidate } from './contract.ts';
import { nameTokens } from './decision.ts';

export type FixtureRecord = { hub: SpecialistHubId; key: string; name: string; entityType: string; identifier?: { label: string; value: string }; location?: string; profilePath?: string };

export const FIVE_ALLIED_FIXTURE: FixtureRecord[] = [
  { hub: 'move', key: 'fx-allied-van-lines', name: 'Allied Van Lines', entityType: 'Mover (Carrier)', identifier: { label: 'USDOT', value: '9000001' }, location: 'Fixtureville, IL', profilePath: '/companies/fx-allied-van-lines' },
  { hub: 'move', key: 'fx-allied-moving', name: 'Allied Moving', entityType: 'Mover (Carrier)', identifier: { label: 'USDOT', value: '9000002' }, location: 'Sampleton, TX', profilePath: '/companies/fx-allied-moving' },
  { hub: 'lender', key: 'fx-allied-lending', name: 'Allied Lending', entityType: 'Lender institution', identifier: { label: 'NMLS', value: '9000003' }, profilePath: '/lender/fx-allied-lending' },
  { hub: 'contractor', key: 'fx-allied-electrical', name: 'Allied Electrical', entityType: 'Electrical contractor', identifier: { label: 'Credential', value: 'FX9000004' }, location: 'Testburg, FL', profilePath: '/contractors/fx-allied-electrical' },
  { hub: 'senior', key: 'fx-allied-senior-care', name: 'Allied Senior Care', entityType: 'Home Health', identifier: { label: 'CMS CCN', value: '900005' }, location: 'Mocksville, FL', profilePath: '/home-health/cms/900005/fx-allied-senior-care' },
  // Sixth, similarly named but DISTINCT identity: must stay a separate card, never merged.
  { hub: 'lender', key: 'fx-allied-lending-group', name: 'Allied Lending Group', entityType: 'Lender institution', identifier: { label: 'NMLS', value: '9000006' }, profilePath: '/lender/fx-allied-lending-group' },
  // Distractors named only with industry words: must NEVER appear for "Allied" / "Allied Moving".
  { hub: 'move', key: 'fx-moving', name: 'Moving', entityType: 'Mover (Carrier)', identifier: { label: 'USDOT', value: '9000007' }, profilePath: '/companies/fx-moving' },
  { hub: 'contractor', key: 'fx-electrical-services', name: 'Electrical Services', entityType: 'Electrical contractor', identifier: { label: 'Credential', value: 'FX9000008' }, profilePath: '/contractors/fx-electrical-services' },
  { hub: 'insurance', key: 'fx-beacon-insurance', name: 'Beacon Insurance Agency', entityType: 'Insurance agency', identifier: { label: 'NPN', value: '9000009' } },
];

const fold = (value: string) => nameTokens(value).join(' ');

/** The FIXTURE HUB's own matcher (stands in for a specialist engine). */
export function fixtureHubMatch(recordName: string, supplied: string): MatchMethod | null {
  if (recordName === supplied) return 'EXACT_SOURCE_NAME';
  const record = fold(recordName), query = fold(supplied);
  if (!query) return null;
  if (record === query) return 'NORMALIZED_NAME';
  const recordTokens = record.split(' '), queryTokens = query.split(' ');
  // Every entered word must appear as a word (or word prefix) of the record name.
  if (queryTokens.every((q) => recordTokens.some((r) => r === q || (q.length >= 3 && r.startsWith(q))))) return record.startsWith(query) ? 'PREFIX_OR_TOKEN' : 'NAME_CONTAINS';
  return null;
}

const PAGE = 5;

/**
 * Controlled hub behaviors for deterministic tests and browser proof.
 *  'fail'                 every call is a technical failure
 *  'unsupported'          the hub cannot search this input by name
 *  'ignore_name_filter'   the hub ignored the name (must surface as a failure)
 *  { emptyFirstPage }     page 1 has nothing admissible but hasMore=true and NO continuation URL
 *  { failFromPage2 }      page 1 is fine; every later page fails
 *  { delayFromPage2Ms }   later pages answer slowly (drives the stale "View more" race)
 */
export type FixtureBehavior = 'fail' | 'unsupported' | 'ignore_name_filter' | { emptyFirstPage?: boolean; failFromPage2?: boolean; delayFromPage2Ms?: number };

export function createFixtureAdapters(records: FixtureRecord[], behavior: Partial<Record<SpecialistHubId, FixtureBehavior>> = {}): Record<SpecialistHubId, HubNameAdapter> {
  const entries = SPECIALIST_HUB_IDS.map((hub): [SpecialistHubId, HubNameAdapter] => {
    const base = { hub, searchedScope: `Fixture ${hub} records`, matchBreadth: 'Fixture hub exact/normalized/prefix/contains matching' };
    const blank: Omit<HubNameSearchOutcome, 'state'> = { ...base, nameFilterApplied: false, candidates: [], returnedCount: 0, hubReportedTotal: null, page: 1, hasMore: false, truncatedWithoutCursor: false, continuation: null, message: null, latencyMs: 0, calls: 1 };
    const toCandidate = (row: FixtureRecord, method: MatchMethod): NameCandidate => ({
      hub, sourceGrain: `fixture ${hub} record`, stableKey: `${hub}:fixture:${row.key}`, displayName: row.name, entityType: row.entityType, matchedName: row.name, matchedField: 'fixture source name',
      matchMethod: method, hubMatchExplanation: 'Fixture hub name match', identifiers: row.identifier ? [row.identifier] : [], recordedLocation: row.location ?? null, locationMeaning: row.location ? 'Recorded location -- not service territory' : null,
      sourceAsOf: '2026-01-01', sourceDateLabel: 'Fixture source date', publicationState: row.profilePath ? 'PUBLIC_PROFILE' : 'RESEARCH_ROW_ONLY',
      action: row.profilePath ? { type: 'PROFILE', href: `${CANONICAL_ORIGINS[hub]}${row.profilePath}`, label: 'Open fixture profile' } : null,
    });
    return [hub, {
      ...base, enabled: true, sourceGrain: `fixture ${hub} record`,
      async search(name, page): Promise<HubNameSearchOutcome> {
        const mine = records.filter((row) => row.hub === hub);
        const mode = behavior[hub]; const opts = typeof mode === 'object' ? mode : {};
        if (mode === 'fail') return { ...blank, page, state: 'TECHNICAL_FAILURE', failureKind: 'unavailable' };
        if (mode === 'unsupported') return { ...blank, page, state: 'UNSUPPORTED_OPERATION', message: `Fixture ${hub} cannot search this input by name.` };
        if (page > 1 && opts.delayFromPage2Ms) await new Promise((resolve) => setTimeout(resolve, opts.delayFromPage2Ms));
        if (page > 1 && opts.failFromPage2) return { ...blank, page, state: 'TECHNICAL_FAILURE', failureKind: 'unavailable' };
        if (behavior[hub] === 'ignore_name_filter') {
          // A broken specialist that IGNORES the name and returns its cohort. It cannot prove the
          // filter ran, so it must surface as a failure -- never as candidates, never as a miss.
          return { ...blank, page, state: 'TECHNICAL_FAILURE', failureKind: 'name_filter_not_proven', message: 'Fixture hub ignored the name filter.' };
        }
        const matched = mine.flatMap((row) => { const method = fixtureHubMatch(row.name, name); return method ? [toCandidate(row, method)] : []; });
        // emptyFirstPage: what a real adapter produces when a hub's first page is all category-word padding
        // (see test H4) -- nothing admissible, more rows exist, and there is no continuation URL.
        if (opts.emptyFirstPage && page === 1 && matched.length) return { ...blank, page, nameFilterApplied: true, hubReportedTotal: matched.length + PAGE, hasMore: true, state: 'PARTIAL_TRUNCATED' };
        const shift = opts.emptyFirstPage ? 1 : 0;
        const slice = matched.slice((page - 1 - shift) * PAGE, (page - shift) * PAGE);
        const hasMore = matched.length > (page - shift) * PAGE;
        return { ...blank, page, nameFilterApplied: true, candidates: slice, returnedCount: slice.length, hubReportedTotal: matched.length, hasMore, state: slice.length ? (hasMore ? 'PARTIAL_TRUNCATED' : 'COMPLETED_WITH_CANDIDATES') : 'COMPLETED_NO_CANDIDATES' };
      },
    }];
  });
  return Object.fromEntries(entries) as Record<SpecialistHubId, HubNameAdapter>;
}

const many = (hub: SpecialistHubId, stem: string, count: number, entityType: string, path: string): FixtureRecord[] => Array.from({ length: count }, (_, i) => ({ hub, key: `fx-${stem.toLowerCase().replaceAll(' ', '-')}-${i + 1}`, name: `${stem} ${String.fromCharCode(65 + i)}`, entityType, profilePath: `${path}/fx-${stem.toLowerCase().replaceAll(' ', '-')}-${i + 1}` }));

/** HYPOTHETICAL records for the paging / continuation / stale-race scenario. */
export const PAGING_RACE_FIXTURE: FixtureRecord[] = [
  { hub: 'move', key: 'fx-borealis-van-lines', name: 'Borealis Van Lines', entityType: 'Mover (Carrier)', identifier: { label: 'USDOT', value: '9100001' }, profilePath: '/companies/fx-borealis-van-lines' },
  ...many('senior', 'Borealis Care Center', 7, 'Nursing Home', '/facility/cms/900100'),
  ...many('lender', 'Borealis Lending', 6, 'Lender institution', '/lender'),
  { hub: 'investor', key: 'fx-aurora-quill', name: 'Aurora Quill Advisors', entityType: 'Investment adviser firm (RIA)', identifier: { label: 'CRD', value: '9100002' } },
];
export const PAGING_RACE_BEHAVIOR: Partial<Record<SpecialistHubId, FixtureBehavior>> = {
  move: { emptyFirstPage: true, delayFromPage2Ms: 6000 }, // page 1 empty+hasMore, no continuation URL; page 2 is slow and holds the record
  lender: { failFromPage2: true },
};

/** HYPOTHETICAL: a relevant source that is DOWN while the customer searches a name with an alternate category reading. */
export const SOURCE_FAILURE_FIXTURE: FixtureRecord[] = [...FIVE_ALLIED_FIXTURE, { hub: 'move', key: 'fx-pure-moving-company', name: 'Pure Moving Company', entityType: 'Mover (Carrier)', profilePath: '/companies/fx-pure-moving-company' }];

export const FIXTURE_SCENARIOS = ['five-allied', 'paging-race', 'source-failure'] as const;

/** The fixture adapters for the scenario named in NAME_CANDIDATES_FIXTURE. */
export function createFixtureAdaptersForScenario(env: Record<string, string | undefined> = process.env): Record<SpecialistHubId, HubNameAdapter> {
  if (env.NAME_CANDIDATES_FIXTURE === 'paging-race') return createFixtureAdapters(PAGING_RACE_FIXTURE, PAGING_RACE_BEHAVIOR);
  if (env.NAME_CANDIDATES_FIXTURE === 'source-failure') return createFixtureAdapters(SOURCE_FAILURE_FIXTURE, { move: 'fail' });
  return createFixtureAdapters(FIVE_ALLIED_FIXTURE);
}

/** Fixture serving is impossible on a production deployment, whatever the env says. */
export function fixtureModeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  // NODE_ENV is deliberately not used: an optimized local `next start` demo runs with NODE_ENV=production.
  return (FIXTURE_SCENARIOS as readonly string[]).includes(env.NAME_CANDIDATES_FIXTURE ?? '') && env.VERCEL_ENV !== 'production';
}
