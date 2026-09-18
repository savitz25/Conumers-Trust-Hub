/**
 * TH-SEARCH-R1-019A: hub adapters for the NAME_CANDIDATES operation.
 *
 * Every adapter calls a structured, already-deployed specialist operation that was verified to
 * accept a supplied name and apply it BEFORE row limits (see docs/qa/th-search-r1-019a). Matching
 * stays in the specialist. An adapter only:
 *   1. sends the supplied name unchanged,
 *   2. proves from the response that the name filter was applied (else: NOT a miss -- a failure),
 *   3. maps rows into the common candidate contract using only hub-supplied facts,
 *   4. rejects malformed/irrelevant contributions (an unfiltered cohort can never be admitted),
 *   5. allowlists every outbound URL. No profile slug or URL is ever constructed by Ask.
 */
import { CANONICAL_ORIGINS, type SpecialistHubId } from '../registry.ts';
import {
  MOVE_NETWORK_CONTRACT_FINGERPRINT, MOVE_NETWORK_RESOLVER_URL, MOVE_NETWORK_RESOLVER_VERSION, MOVE_NETWORK_SCHEMA_FINGERPRINT,
} from '../move-network-resolver.ts';
import { SENIOR_ASK_API, SENIOR_ASK_CONTRACT } from '../senior-ask.ts';
import {
  HUB_PAGE_SIZE, type CandidateAction, type HubNameSearchOutcome, type MatchMethod, type NameCandidate,
} from './contract.ts';
import { isGenericNameToken, nameTokens } from './decision.ts';

export const NAME_SPECIALIST_CONTRACT = 'trusthub-specialist-execution-v2';
/** Version + structural-shape locks (contractFingerprint intentionally not pinned -- see TH-ARCH-P0-002). */
export const NAME_SPECIALIST_LOCKS = {
  investor: { url: process.env.INVESTOR_SPECIALIST_EXECUTION_URL ?? 'https://www.investortrusthub.com/api/specialist-execution/v2', version: '2.0.0', schemaFingerprint: 'a92b72c4a30de1021ecf25d26decb852b52394f741ac26919b89d14a234ab384' },
  insurance: { url: process.env.INSURANCE_SPECIALIST_EXECUTION_URL ?? 'https://www.insurancetrusthub.com/api/specialist-execution/v2', version: '2.0.0', schemaFingerprint: '4aa93bb372aebb45c7028b750000e77be4a847d9a210f3c40d3db1df1f7f637f' },
  lender: { url: process.env.LENDER_SPECIALIST_EXECUTION_URL ?? 'https://www.lendertrusthub.com/api/specialist-execution/v2', version: '2.1.0', schemaFingerprint: '0da572d08450e68f4f01a4f4b28e2e813503f50b1a84546a29d7eb817db205dd' },
} as const;

export type AdapterContext = { fetcher: typeof fetch; signal: AbortSignal };
export type HubNameAdapter = {
  hub: SpecialistHubId;
  /** False = operation not available through a verified structured contract. */
  enabled: boolean;
  sourceGrain: string;
  searchedScope: string;
  matchBreadth: string;
  /** Why a disabled adapter is disabled, and the exact dependency that would enable it. */
  dependency?: string;
  search(name: string, page: number, ctx: AdapterContext): Promise<HubNameSearchOutcome>;
};

const OFFICIAL_ORIGINS: Partial<Record<SpecialistHubId, string[]>> = {
  investor: ['https://adviserinfo.sec.gov'],
  lender: ['https://www.consumerfinance.gov'],
};

/** Query params that select WHICH record a hub link opens. */
const RECORD_IDENTITY_PARAMS = new Set(['selected', 'id', 'slug', 'crd', 'ccn', 'npn', 'naic', 'nmls', 'lei', 'usdot', 'mc', 'q']);

function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function records(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.filter((row) => row && typeof row === 'object' && !Array.isArray(row)) as Record<string, unknown>[] : []; }
const fold = (value: string) => nameTokens(value).join(' ');
/** Separator-insensitive form for ECHO comparison only: hubs differ on whether "Al's" folds to "als" or "al s". */
const squash = (value: string) => nameTokens(value).join('');
/** True when the hub's echo of the searched name is the name we sent. */
export const echoesName = (echo: string | null, name: string): boolean => Boolean(echo) && squash(echo!) === squash(name);

/** Allowlisted absolute https URL on the hub's canonical origin (or its official source). */
export function safeHubUrl(hub: SpecialistHubId, raw: unknown): { href: string; official: boolean } | null {
  const value = text(raw); if (!value) return null;
  const origin = CANONICAL_ORIGINS[hub];
  let url: URL; try { url = new URL(value, origin); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  // URL hygiene on a HUB-SUPPLIED action (nothing is constructed): some hub links carry params whose
  // value is the literal string "undefined"/"null", which breaks the hub's own page. Drop only those.
  for (const [key, val] of [...url.searchParams.entries()]) {
    if (val !== 'undefined' && val !== 'null') continue;
    // A broken param that IDENTIFIES the record cannot be dropped: the link would silently open an
    // unscoped page. No link is more honest than the wrong link.
    if (RECORD_IDENTITY_PARAMS.has(key.toLowerCase())) return null;
    url.searchParams.delete(key);
  }
  if (url.origin === origin) return { href: url.toString(), official: false };
  if (OFFICIAL_ORIGINS[hub]?.includes(url.origin)) return { href: url.toString(), official: true };
  return null;
}

function action(hub: SpecialistHubId, raw: unknown, kind: 'PROFILE' | 'RESEARCH', hubName: string): CandidateAction | null {
  const safe = safeHubUrl(hub, raw); if (!safe) return null;
  if (safe.official) return { type: 'OFFICIAL_SOURCE', href: safe.href, label: 'Verify with the official source' };
  return kind === 'PROFILE' ? { type: 'PROFILE', href: safe.href, label: `Open ${hubName} profile` } : { type: 'RESEARCH', href: safe.href, label: `Continue research on ${hubName}` };
}

/**
 * Row-level relevance guard. This is contribution validation, not matching: a row whose matched
 * source name shares nothing with the supplied name cannot be a name candidate, whatever the hub
 * said. Hub-labelled similar-spelling suggestions are exempt from token sharing only when the
 * response as a whole proved the name filter ran.
 */
export function rowRelatesToName(suppliedName: string, matchedName: string | null, method: MatchMethod): boolean {
  // The hub matched a documented alias / historical name it does not return. The relation is
  // source-established (and the response-level echo proved the filter ran); the CURRENT display name
  // having different words is not grounds to discard it. Only this explicit method is exempt.
  if (matchedName === null) return method === 'DOCUMENTED_ALIAS';
  const all = nameTokens(suppliedName);
  const matched = nameTokens(matchedName);
  if (!all.length || !matched.length) return false;
  // Whole-name containment must fall on WORD boundaries. A hub "contains" match that lands mid-word
  // ("alpha asset management" inside "CLEVERALPHA ASSET MANAGEMENT") is not a name candidate.
  if (` ${fold(matchedName)} `.includes(` ${fold(suppliedName)} `)) return true;
  // No category-word-only padding: when the supplied name has a distinctive part ("C&L" in "C&L Movers
  // LLC"), a row must relate to THAT part -- sharing only "Movers"/"LLC" is not a name candidate.
  const distinct = all.filter((t) => !isGenericNameToken(t));
  if (distinct.length && distinct.every((t) => t.length < 2)) return squash(matchedName).includes(distinct.join(''));
  const supplied = (distinct.length ? distinct : all).filter((t) => t.length >= 2);
  if (!supplied.length) return false;
  const shares = supplied.some((s) => matched.some((m) => m === s || (s.length >= 3 && m.startsWith(s)) || (m.length >= 3 && s.startsWith(m))));
  if (shares) return true;
  if (method !== 'SIMILAR_SPELLING') return false;
  // Similar spelling: bounded edit-distance sanity check so a labelled "suggestion" is still plausibly about this name.
  return supplied.some((s) => matched.some((m) => Math.abs(m.length - s.length) <= 2 && editDistanceAtMost(s, m, 2)));
}

function editDistanceAtMost(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let rowMin = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); rowMin = Math.min(rowMin, cur[j]); }
    if (rowMin > max) return false; prev = cur;
  }
  return prev[b.length] <= max;
}

type Base = Pick<HubNameSearchOutcome, 'hub' | 'searchedScope' | 'matchBreadth'>;
function outcome(base: Base, partial: Partial<HubNameSearchOutcome> & Pick<HubNameSearchOutcome, 'state'>, started: number, page: number): HubNameSearchOutcome {
  const candidates = partial.candidates ?? [];
  return { ...base, nameFilterApplied: false, candidates, returnedCount: candidates.length, hubReportedTotal: null, page, hasMore: false, truncatedWithoutCursor: false, continuation: null, message: null, latencyMs: Date.now() - started, calls: 1, ...partial };
}

async function call(ctx: AdapterContext, url: string | URL, init: RequestInit): Promise<{ status: number; body: Record<string, unknown> } | { failure: 'timeout' | 'unavailable' }> {
  try {
    const response = await ctx.fetcher(url, { ...init, signal: ctx.signal, cache: 'no-store', headers: { accept: 'application/json', 'user-agent': 'AskTrustHub-Name-Candidates/1', ...(init.headers ?? {}) } });
    const body = await response.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { failure: 'unavailable' };
    return { status: response.status, body: body as Record<string, unknown> };
  } catch (error) {
    return { failure: error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError') ? 'timeout' : 'unavailable' };
  }
}

/** Shared tail: relevance guard + cohort-masquerade rejection + state selection. */
type Upstream = { state: string; hubName: string; continuation: CandidateAction | null };
function finish(base: Base, name: string, mapped: NameCandidate[], rawRowCount: number, extra: Partial<HubNameSearchOutcome>, started: number, page: number, upstream?: Upstream): HubNameSearchOutcome {
  // Rows were returned but none could be mapped into the candidate contract: a malformed payload, never a miss.
  if (rawRowCount > 0 && mapped.length === 0) return outcome(base, { state: 'TECHNICAL_FAILURE', failureKind: 'invalid_response', message: 'The specialist returned records in an unexpected shape, so they were not shown.' }, started, page);
  if (upstream && rawRowCount === 0) {
    // A valid upstream ambiguity is NOT a completed miss: several identities share this name, the
    // endpoint simply does not return them. Nothing is manufactured or selected.
    if (upstream.state === 'AMBIGUOUS_IDENTITIES') return outcome(base, { state: 'AMBIGUOUS_NO_CANDIDATES', nameFilterApplied: true, continuation: upstream.continuation, message: `${upstream.hubName} reports that more than one record shares this name, but this endpoint does not return them. This is not a "no match" result.` }, started, page);
    // The hub claims a match yet supplied no record: contradictory payload, never a miss.
    if (upstream.state === 'EXACT_IDENTITY' || upstream.state === 'SUPPORTED_RESULTS') return outcome(base, { state: 'TECHNICAL_FAILURE', failureKind: 'invalid_response', message: 'The specialist reported a match but returned no record.' }, started, page);
  }
  const admitted = mapped.filter((c) => rowRelatesToName(name, c.matchedName, c.matchMethod));
  if (rawRowCount > 0 && admitted.length === 0) {
    // Two very different situations produce "no admissible rows":
    //  - rows that share NOTHING with the name: the hub ignored the filter -> a failure, never a miss;
    //  - rows that share only generic words ("C&L Movers" -> "Call The Movers"): category-word padding
    //    from a hub that DID search the name. Those rows are dropped; the search itself completed.
    const supplied = new Set(nameTokens(name).filter((t) => t.length >= 2));
    const padding = mapped.some((c) => nameTokens(c.matchedName ?? c.displayName).some((t) => supplied.has(t)));
    if (!padding) return outcome(base, { state: 'TECHNICAL_FAILURE', failureKind: 'name_filter_not_proven', message: 'The specialist returned records that do not relate to this name, so they were not shown as matches.' }, started, page);
  }
  const seen = new Set<string>();
  const candidates = admitted.filter((c) => (seen.has(c.stableKey) ? false : (seen.add(c.stableKey), true)));
  const truncated = Boolean(extra.hasMore || extra.truncatedWithoutCursor);
  // With more rows available at the hub, an empty admitted page is "partial", not a completed miss.
  return outcome(base, { ...extra, nameFilterApplied: true, candidates, state: truncated ? 'PARTIAL_TRUNCATED' : candidates.length ? 'COMPLETED_WITH_CANDIDATES' : 'COMPLETED_NO_CANDIDATES' }, started, page);
}

// ---------------------------------------------------------------- Move
const MOVE_METHOD: Record<string, MatchMethod> = {
  exact_display_name: 'EXACT_SOURCE_NAME', exact_legal_name: 'EXACT_SOURCE_NAME', exact_alias: 'DOCUMENTED_ALIAS',
  display_prefix: 'PREFIX_OR_TOKEN', legal_prefix: 'PREFIX_OR_TOKEN', token_prefix: 'PREFIX_OR_TOKEN', substring: 'NAME_CONTAINS', similar_name: 'SIMILAR_SPELLING',
};
const moveBase: Base = { hub: 'move', searchedScope: 'Public MoveTrustHub mover identities (FMCSA-sourced)', matchBreadth: 'Exact, prefix/token, contained and similar-spelling company-name matches' };
export const moveNameAdapter: HubNameAdapter = {
  ...moveBase, enabled: true, sourceGrain: 'FMCSA public mover identity',
  async search(name, page, ctx) {
    const started = Date.now();
    // The resolver returns the strongest matches first with no page cursor; later "pages" widen the limit.
    const limit = Math.min(HUB_PAGE_SIZE * page, 25);
    const url = new URL(MOVE_NETWORK_RESOLVER_URL);
    url.searchParams.set('q', name); url.searchParams.set('contract_version', MOVE_NETWORK_RESOLVER_VERSION);
    url.searchParams.set('intent', 'company_name'); url.searchParams.set('limit', String(limit));
    const res = await call(ctx, url, { method: 'GET' });
    if ('failure' in res) return outcome(moveBase, { state: 'TECHNICAL_FAILURE', failureKind: res.failure }, started, page);
    const p = res.body;
    if (res.status === 400) return outcome(moveBase, { state: 'UNSUPPORTED_OPERATION', message: 'MoveTrustHub could not search this input as a company name.' }, started, page);
    if (res.status !== 200) return outcome(moveBase, { state: 'TECHNICAL_FAILURE', failureKind: 'unavailable' }, started, page);
    if (p.contractVersion !== MOVE_NETWORK_RESOLVER_VERSION || p.schemaFingerprint !== MOVE_NETWORK_SCHEMA_FINGERPRINT || p.contractFingerprint !== MOVE_NETWORK_CONTRACT_FINGERPRINT || !Array.isArray(p.results)) {
      return outcome(moveBase, { state: 'TECHNICAL_FAILURE', failureKind: 'contract_mismatch' }, started, page);
    }
    // Proof the name filter ran: the hub echoes its normalized form of OUR name.
    if (!echoesName(text(p.normalizedQuery), name)) return outcome(moveBase, { state: 'TECHNICAL_FAILURE', failureKind: 'name_filter_not_proven' }, started, page);
    const rows = records(p.results);
    const mapped = rows.flatMap((row): NameCandidate[] => {
      const display = text(row.publicDisplayName); const slug = text(row.canonicalSlug);
      const method = MOVE_METHOD[text(row.matchClass) ?? '']; const act = action('move', row.canonicalUrl, 'PROFILE', 'MoveTrustHub');
      if (!display || !slug || !method || !act) return [];
      const legal = text(row.legalName); const legalField = /legal/.test(text(row.matchClass) ?? '');
      const hq = record(row.recordedHq); const usdot = text(row.usdot); const mc = text(row.mc);
      return [{
        hub: 'move', sourceGrain: 'FMCSA public mover identity', stableKey: `move:profile:${slug}`, displayName: display,
        entityType: text(row.role) && row.role !== 'Unknown' ? `Mover (${row.role})` : 'Mover',
        // A documented alias is source-established, but the resolver does not return the alias text.
        matchedName: method === 'DOCUMENTED_ALIAS' ? null : legalField && legal ? legal : display,
        matchedField: method === 'DOCUMENTED_ALIAS' ? 'a documented alias (the source does not return the alias text)' : legalField ? 'FMCSA legal name' : 'public display name',
        matchMethod: method, hubMatchExplanation: text(row.matchReason),
        identifiers: [usdot ? { label: 'USDOT', value: usdot } : null, mc ? { label: 'MC', value: mc } : null].filter(Boolean) as NameCandidate['identifiers'],
        recordedLocation: text(hq.raw), locationMeaning: 'Recorded headquarters -- not service territory', sourceAsOf: text(row.sourceLastChecked), sourceDateLabel: 'Last checked by MoveTrustHub',
        publicationState: 'PUBLIC_PROFILE', action: act,
      }];
    });
    const total = typeof p.totalMatchingIdentityCount === 'number' ? p.totalMatchingIdentityCount : null;
    const more = total !== null && total > rows.length;
    return finish(moveBase, name, mapped, rows.length, {
      hubReportedTotal: total, hasMore: more && limit < 25, truncatedWithoutCursor: more && limit >= 25,
      continuation: more ? action('move', `/?q=${encodeURIComponent(name)}`, 'RESEARCH', 'MoveTrustHub') : null,
    }, started, page);
  },
};

// ---------------------------------------------------------------- v2 identity (Investor / Insurance / Lender)
const HUB_NAME = { investor: 'InvestorTrustHub', insurance: 'InsuranceTrustHub', lender: 'LenderTrustHub' } as const;
async function v2Identity(hub: 'investor' | 'insurance' | 'lender', base: Base, body: Record<string, unknown>, ctx: AdapterContext, started: number, page: number) {
  const lock = NAME_SPECIALIST_LOCKS[hub];
  const res = await call(ctx, lock.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contract: NAME_SPECIALIST_CONTRACT, queryType: 'identity', ...body }) });
  if ('failure' in res) return { fail: outcome(base, { state: 'TECHNICAL_FAILURE', failureKind: res.failure }, started, page) };
  const p = res.body;
  if (text(p.contract) !== NAME_SPECIALIST_CONTRACT || text(p.contractVersion) !== lock.version || text(p.schemaFingerprint) !== lock.schemaFingerprint) {
    return { fail: outcome(base, { state: 'TECHNICAL_FAILURE', failureKind: 'contract_mismatch' }, started, page) };
  }
  const state = text(p.resultState) ?? '';
  if (state === 'UNSUPPORTED_CAPABILITY' || state === 'INVALID_QUERY') return { fail: outcome(base, { state: 'UNSUPPORTED_OPERATION', message: text(p.message) }, started, page) };
  if (state === 'PUBLICATION_RESTRICTED') return { fail: outcome(base, { state: 'POLICY_RESTRICTED', message: text(p.message) ?? 'Matching records are not published for name discovery.' }, started, page) };
  if (!['SUPPORTED_RESULTS', 'ZERO_MATCHING_ROWS', 'EXACT_IDENTITY', 'NO_CONFIDENT_MATCH', 'AMBIGUOUS_IDENTITIES'].includes(state)) {
    return { fail: outcome(base, { state: 'TECHNICAL_FAILURE', failureKind: res.status >= 500 ? 'unavailable' : 'invalid_response' }, started, page) };
  }
  return { payload: p, state, continuation: records(p.destinations).map((d) => action(hub, d.url, 'RESEARCH', HUB_NAME[hub])).find((a) => a && a.type !== 'OFFICIAL_SOURCE') ?? null };
}

const investorBase: Base = { hub: 'investor', searchedScope: 'Current SEC/IARD investment-adviser firms (RIA and ERA)', matchBreadth: 'Firm display/legal names containing the entered text' };
export const investorNameAdapter: HubNameAdapter = {
  ...investorBase, enabled: true, sourceGrain: 'SEC/IARD Form ADV firm',
  async search(name, page, ctx) {
    const started = Date.now();
    const r = await v2Identity('investor', investorBase, { identityName: name, page, limit: HUB_PAGE_SIZE }, ctx, started, page);
    if ('fail' in r) return r.fail!;
    const p = r.payload;
    if (!echoesName(text(record(p.appliedFilters).identityName), name)) return outcome(investorBase, { state: 'TECHNICAL_FAILURE', failureKind: 'name_filter_not_proven' }, started, page);
    const rows = records(p.rows);
    const mapped = rows.flatMap((row): NameCandidate[] => {
      const firm = text(row.firmName); const legal = text(row.legalName); const crd = text(row.crd);
      if (!crd || !(firm || legal)) return [];
      const why = text(row.whyMatched) ?? '';
      const onLegal = /Matched source legal name/i.test(why);
      const matchedName = onLegal && legal ? legal : firm ?? legal!;
      const profile = action('investor', row.canonicalProfileUrl, 'PROFILE', 'InvestorTrustHub');
      const official = records(row.destinations).map((d) => action('investor', d.url, 'RESEARCH', 'InvestorTrustHub')).find(Boolean) ?? null;
      const exact = fold(matchedName) === fold(name);
      return [{
        hub: 'investor', sourceGrain: 'SEC/IARD Form ADV firm', stableKey: `investor:crd:${crd}`, displayName: firm ?? legal!,
        entityType: text(row.firmClass) ? `Investment adviser firm (${String(row.firmClass).toUpperCase()})` : 'Investment adviser firm',
        matchedName, matchedField: onLegal ? 'SEC/IARD legal name' : 'SEC/IARD firm name',
        // The hub reports "contains"; a byte-for-byte normalized equality of the RETURNED name is described as such.
        matchMethod: exact ? 'NORMALIZED_NAME' : 'NAME_CONTAINS', hubMatchExplanation: why || null,
        identifiers: [{ label: 'CRD', value: crd }], recordedLocation: text(row.principalOffice), locationMeaning: 'Principal office -- not client geography',
        sourceAsOf: text(row.sourceAsOf) ?? text(row.filingDate), sourceDateLabel: text(row.sourceAsOf) ? 'Source as-of date' : 'Form ADV filing date', publicationState: text(row.publicationState), action: profile ?? official,
      }];
    });
    const pagination = record(p.pagination);
    return finish(investorBase, name, mapped, rows.length, { hubReportedTotal: typeof p.total === 'number' ? p.total : null, hasMore: pagination.hasMore === true }, started, page, { state: r.state, hubName: 'InvestorTrustHub', continuation: r.continuation });
  },
};

const INSURANCE_METHOD: Record<string, MatchMethod> = { exact_name: 'EXACT_SOURCE_NAME', exact: 'EXACT_SOURCE_NAME', normalized_exact: 'NORMALIZED_NAME', normalized_name: 'NORMALIZED_NAME', alias: 'DOCUMENTED_ALIAS', distinctive_token_candidate: 'PREFIX_OR_TOKEN', token_candidate: 'PREFIX_OR_TOKEN', prefix: 'PREFIX_OR_TOKEN', fuzzy: 'SIMILAR_SPELLING' };
const insuranceBase: Base = { hub: 'insurance', searchedScope: 'Public-safe insurance agencies and published legal insurers (individual producers are not searched)', matchBreadth: 'Organization names containing every distinctive word entered; capped at 10 per request' };
export const insuranceNameAdapter: HubNameAdapter = {
  ...insuranceBase, enabled: true, sourceGrain: 'NIPR/NAIC-sourced insurance organization',
  async search(name, page, ctx) {
    const started = Date.now();
    const r = await v2Identity('insurance', insuranceBase, { identityName: name, limit: HUB_PAGE_SIZE }, ctx, started, page);
    if ('fail' in r) return r.fail!;
    const p = r.payload;
    const echoed = records(record(p.queryInterpretation).interpretation).find((row) => text(row.label) === 'Requested name');
    if (!echoesName(text(echoed?.value ?? null), name)) return outcome(insuranceBase, { state: 'TECHNICAL_FAILURE', failureKind: 'name_filter_not_proven' }, started, page);
    const rows = records(p.rows);
    const mapped = rows.flatMap((row): NameCandidate[] => {
      const entityClass = text(row.entityClass);
      // Private-person restriction: only organization grains are ever admitted for name discovery.
      if (entityClass !== 'agency' && entityClass !== 'legal_insurer') return [];
      const display = text(row.name); const evidence = record(row.matchEvidence);
      const npn = text(row.npn); const naic = text(row.naicCode); const key = naic ? `naic:${naic}` : npn ? `npn:${npn}` : text(evidence.entityId) ? `entity:${text(evidence.entityId)}` : null;
      const matchedName = text(evidence.value); const field = text(evidence.field);
      if (!display || !key || !matchedName || !field) return [];
      const isProfile = text(row.publicationState) === 'PUBLIC_PROFILE';
      return [{
        hub: 'insurance', sourceGrain: 'NIPR/NAIC-sourced insurance organization', stableKey: `insurance:${key}`, displayName: display,
        entityType: entityClass === 'legal_insurer' ? 'Legal insurer' : 'Insurance agency', matchedName, matchedField: field.replaceAll('_', ' '),
        matchMethod: INSURANCE_METHOD[text(evidence.method) ?? ''] ?? 'HUB_NAME_MATCH', hubMatchExplanation: text(row.whyMatched),
        identifiers: [naic ? { label: 'NAIC Company Code', value: naic } : null, npn ? { label: 'NPN', value: npn } : null].filter(Boolean) as NameCandidate['identifiers'],
        recordedLocation: text(row.credentialJurisdiction), locationMeaning: text(row.credentialJurisdiction) ? 'Credential jurisdiction -- not office or service area' : null,
        sourceAsOf: text(row.sourceObservedAt), sourceDateLabel: 'Observed in source on', publicationState: text(row.publicationState),
        action: isProfile ? action('insurance', row.destination, 'PROFILE', 'InsuranceTrustHub') : action('insurance', row.selectionUrl, 'RESEARCH', 'InsuranceTrustHub'),
      }];
    });
    // The hub caps identity candidates at 10 with no cursor and asserts no exact total.
    const capped = rows.length >= HUB_PAGE_SIZE;
    return finish(insuranceBase, name, mapped, rows.length, { truncatedWithoutCursor: capped, continuation: capped ? action('insurance', `/ask?q=${encodeURIComponent(`Find ${name}`)}`, 'RESEARCH', 'InsuranceTrustHub') : null }, started, page, { state: r.state, hubName: 'InsuranceTrustHub', continuation: r.continuation });
  },
};

const lenderBase: Base = { hub: 'lender', searchedScope: 'Accepted public lender institutions', matchBreadth: 'EXACT public or historical institution name only -- partial names are not matched by this source' };
export const lenderNameAdapter: HubNameAdapter = {
  ...lenderBase, enabled: true, sourceGrain: 'NMLS/LEI lender institution',
  async search(name, page, ctx) {
    const started = Date.now();
    const r = await v2Identity('lender', lenderBase, { identityName: name, limit: HUB_PAGE_SIZE }, ctx, started, page);
    if ('fail' in r) return r.fail!;
    const p = r.payload; const qi = record(p.queryInterpretation);
    if (!echoesName(text(qi.identityName), name)) return outcome(lenderBase, { state: 'TECHNICAL_FAILURE', failureKind: 'name_filter_not_proven' }, started, page);
    const identity = record(p.identity);
    const rows = records(p.rows).length ? records(p.rows) : Object.keys(identity).length ? [identity] : [];
    const mapped = rows.flatMap((row): NameCandidate[] => {
      const display = text(row.displayName) ?? text(row.institutionName); const nmls = text(row.nmls); const lei = text(row.lei);
      const key = nmls ? `nmls:${nmls}` : lei ? `lei:${lei}` : null;
      if (!display || !key) return [];
      return [{
        hub: 'lender', sourceGrain: 'NMLS/LEI lender institution', stableKey: `lender:${key}`, displayName: display, entityType: 'Lender institution',
        // The hub matches EXACT public or historical names. When the returned display name is not what was
        // entered, the match was on a historical/alternate name the endpoint does not return.
        matchedName: fold(display) === fold(name) ? display : null,
        matchedField: fold(display) === fold(name) ? 'accepted public institution name' : 'a historical or alternate institution name (the source does not return that text)',
        matchMethod: fold(display) === fold(name) ? 'EXACT_SOURCE_NAME' : 'DOCUMENTED_ALIAS', hubMatchExplanation: text(qi.matchMethod)?.replaceAll('_', ' ') ?? null,
        identifiers: [nmls ? { label: 'NMLS', value: nmls } : null, lei ? { label: 'LEI', value: lei } : null].filter(Boolean) as NameCandidate['identifiers'],
        recordedLocation: null, locationMeaning: null, sourceAsOf: text(row.sourceFetchedAt), sourceDateLabel: 'Fetched from source on', publicationState: text(row.publicationState),
        action: action('lender', record(row.destination).url, 'PROFILE', 'LenderTrustHub'),
      }];
    });
    // Ambiguity continuation: the payload's own hub destination, else the hub's existing public lender directory.
    return finish(lenderBase, name, mapped, rows.length, {}, started, page, { state: r.state, hubName: 'LenderTrustHub', continuation: r.continuation ?? action('lender', '/lender', 'RESEARCH', 'LenderTrustHub') });
  },
};

// ---------------------------------------------------------------- Senior (senior-ask-v1 JSON contract; the same engine as the native site)
const seniorBase: Base = { hub: 'senior', searchedScope: 'Current CMS nursing home, home health and hospice directories', matchBreadth: 'Bounded provider-name matches in the CMS directories' };
export const seniorNameAdapter: HubNameAdapter = {
  ...seniorBase, enabled: true, sourceGrain: 'CMS certified provider (CCN)',
  async search(name, page, ctx) {
    const started = Date.now();
    const url = new URL(SENIOR_ASK_API); url.searchParams.set('q', name); if (page > 1) url.searchParams.set('page', String(page));
    const res = await call(ctx, url, { method: 'GET' });
    if ('failure' in res) return outcome(seniorBase, { state: 'TECHNICAL_FAILURE', failureKind: res.failure }, started, page);
    const p = res.body;
    if (text(p.contract) !== SENIOR_ASK_CONTRACT) return outcome(seniorBase, { state: 'TECHNICAL_FAILURE', failureKind: 'contract_mismatch' }, started, page);
    if (res.status !== 200) return outcome(seniorBase, { state: 'TECHNICAL_FAILURE', failureKind: 'unavailable' }, started, page);
    const query = record(p.query);
    // This endpoint interprets free text. Unless it PROVES it ran a provider-name search on exactly
    // our name, its answer is about some other question -- never a name miss.
    if (text(query.mode) !== 'entity' || !echoesName(text(query.identityQuery), name)) {
      return outcome(seniorBase, { state: 'UNSUPPORTED_OPERATION', message: 'SeniorTrustHub interpreted this text as a care-category question instead of a provider name, so a name search could not be confirmed.' }, started, page);
    }
    const rows = records(p.results);
    const mapped = rows.flatMap((row): NameCandidate[] => {
      const display = text(row.providerName); const ccn = text(row.ccn); const cls = text(row.providerClass);
      const act = action('senior', row.href, 'PROFILE', 'SeniorTrustHub');
      if (!display || !ccn || !/^\d{6}$/.test(ccn) || !cls || !act) return [];
      return [{
        hub: 'senior', sourceGrain: 'CMS certified provider (CCN)', stableKey: `senior:${cls}:${ccn}`, displayName: display,
        entityType: cls.replaceAll('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()), matchedName: display, matchedField: 'CMS provider name',
        matchMethod: fold(display) === fold(name) ? 'NORMALIZED_NAME' : 'HUB_NAME_MATCH', hubMatchExplanation: text(row.whyMatched),
        identifiers: [{ label: 'CMS CCN', value: ccn }], recordedLocation: text(row.location), locationMeaning: 'Recorded CMS location -- not service availability',
        sourceAsOf: text(row.sourceAsOf), sourceDateLabel: 'CMS source as-of date', publicationState: 'PUBLIC_PROFILE', action: act,
      }];
    });
    const pagination = record(p.pagination);
    return finish(seniorBase, name, mapped, rows.length, { hasMore: pagination.hasMore === true || (typeof pagination.totalPages === 'number' && pagination.totalPages > page) }, started, page);
  },
};

// ---------------------------------------------------------------- Contractor (blocked: no structured name operation)
const contractorBase: Base = { hub: 'contractor', searchedScope: 'Not searched by name', matchBreadth: 'No structured name operation is available' };
export const CONTRACTOR_NAME_DEPENDENCY = 'ContractorTrustHub /api/specialist-execution/v2 declares queryType "identity" but rejects any name field (unsupported_field). Its existing searchContractors() engine (behind /verify) already performs name search; a thin v2 wrapper exposing identityName over that engine is required. Owner: ContractorTrustHub.';
export const contractorNameAdapter: HubNameAdapter = {
  ...contractorBase, enabled: false, sourceGrain: 'State contractor credential', dependency: CONTRACTOR_NAME_DEPENDENCY,
  async search(_name, page) {
    return { ...contractorBase, state: 'UNSUPPORTED_OPERATION', nameFilterApplied: false, candidates: [], returnedCount: 0, hubReportedTotal: null, page, hasMore: false, truncatedWithoutCursor: false,
      continuation: { type: 'VERIFY', href: `${CANONICAL_ORIGINS.contractor}/verify?q=${encodeURIComponent(_name)}`, label: 'Search this name on ContractorTrustHub Verify' },
      message: 'ContractorTrustHub cannot yet be searched by name from here. Its own Verify search can.', latencyMs: 0, calls: 0 };
  },
};

export const NAME_ADAPTERS: Record<SpecialistHubId, HubNameAdapter> = {
  move: moveNameAdapter, lender: lenderNameAdapter, insurance: insuranceNameAdapter,
  contractor: contractorNameAdapter, senior: seniorNameAdapter, investor: investorNameAdapter,
};
