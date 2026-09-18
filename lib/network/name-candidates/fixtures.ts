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

export function createFixtureAdapters(records: FixtureRecord[], behavior: Partial<Record<SpecialistHubId, 'fail' | 'ignore_name_filter' | 'silent'>> = {}): Record<SpecialistHubId, HubNameAdapter> {
  const entries = SPECIALIST_HUB_IDS.map((hub): [SpecialistHubId, HubNameAdapter] => {
    const base = { hub, searchedScope: `Fixture ${hub} records`, matchBreadth: 'Fixture hub exact/normalized/prefix/contains matching' };
    const blank: Omit<HubNameSearchOutcome, 'state'> = { ...base, nameFilterApplied: false, candidates: [], returnedCount: 0, hubReportedTotal: null, page: 1, hasMore: false, truncatedWithoutCursor: false, continuation: null, message: null, latencyMs: 0, calls: 1 };
    const toCandidate = (row: FixtureRecord, method: MatchMethod): NameCandidate => ({
      hub, sourceGrain: `fixture ${hub} record`, stableKey: `${hub}:fixture:${row.key}`, displayName: row.name, entityType: row.entityType, matchedName: row.name, matchedField: 'fixture source name',
      matchMethod: method, hubMatchExplanation: 'Fixture hub name match', identifiers: row.identifier ? [row.identifier] : [], recordedLocation: row.location ?? null, locationMeaning: row.location ? 'Recorded location -- not service territory' : null,
      sourceAsOf: '2026-01-01', publicationState: row.profilePath ? 'PUBLIC_PROFILE' : 'RESEARCH_ROW_ONLY',
      action: row.profilePath ? { type: 'PROFILE', href: `${CANONICAL_ORIGINS[hub]}${row.profilePath}`, label: 'Open fixture profile' } : null,
    });
    return [hub, {
      ...base, enabled: true, sourceGrain: `fixture ${hub} record`,
      async search(name, page): Promise<HubNameSearchOutcome> {
        const mine = records.filter((row) => row.hub === hub);
        if (behavior[hub] === 'fail') return { ...blank, page, state: 'TECHNICAL_FAILURE', failureKind: 'unavailable' };
        if (behavior[hub] === 'ignore_name_filter') {
          // A broken specialist that IGNORES the name and returns its cohort. It cannot prove the
          // filter ran, so it must surface as a failure -- never as candidates, never as a miss.
          return { ...blank, page, state: 'TECHNICAL_FAILURE', failureKind: 'name_filter_not_proven', message: 'Fixture hub ignored the name filter.' };
        }
        const matched = mine.flatMap((row) => { const method = fixtureHubMatch(row.name, name); return method ? [toCandidate(row, method)] : []; });
        const slice = matched.slice((page - 1) * PAGE, page * PAGE);
        const hasMore = matched.length > page * PAGE;
        return { ...blank, page, nameFilterApplied: true, candidates: slice, returnedCount: slice.length, hubReportedTotal: matched.length, hasMore, state: slice.length ? (hasMore ? 'PARTIAL_TRUNCATED' : 'COMPLETED_WITH_CANDIDATES') : 'COMPLETED_NO_CANDIDATES' };
      },
    }];
  });
  return Object.fromEntries(entries) as Record<SpecialistHubId, HubNameAdapter>;
}

/** Fixture serving is impossible on a production deployment, whatever the env says. */
export function fixtureModeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  // NODE_ENV is deliberately not used: an optimized local `next start` demo runs with NODE_ENV=production.
  return env.NAME_CANDIDATES_FIXTURE === 'five-allied' && env.VERCEL_ENV !== 'production';
}
