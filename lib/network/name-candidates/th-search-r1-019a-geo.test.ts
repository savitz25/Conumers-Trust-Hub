/**
 * TH-SEARCH-R1-019A final integration correction: GEOGRAPHY INSIDE A SUPPLIED NAME.
 *
 * Found by the frozen holdout after main published Ohio: the planner began recognizing "Cincinnati"
 * as geography, the decision layer removed recognized geography from a name's distinctive words, and
 * "Cincinnati Asset Management" stopped being a name search. Invariant proved here: recognizing MORE
 * places never makes an organization name LESS discoverable. Geography is context, not a disqualifier.
 *
 * Classification is the REAL planner + decision; only hub outcomes are controlled fixtures.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { planAskResearch, type AskResearchPlan } from '../research-planner.ts';
import { decideNameCandidateSearch } from './decision.ts';
import { resolveAskNameState } from './page-state.ts';
import { buildNameResultsView } from './view.ts';
import { createFixtureAdapters, type FixtureBehavior, type FixtureRecord } from './fixtures.ts';
import type { HubNameAdapter } from './adapters.ts';
import { SPECIALIST_HUB_IDS, type SpecialistHubId } from '../registry.ts';

// HYPOTHETICAL fixture records (no identifier or URL from any real source is used by routing).
const FIRM: FixtureRecord = { hub: 'investor', key: 'fx-cincinnati-asset-management', name: 'CINCINNATI ASSET MANAGEMENT INC', entityType: 'Investment adviser firm (RIA)', identifier: { label: 'CRD', value: '9200001' } };
const OTHER: FixtureRecord = { hub: 'lender', key: 'fx-cincinnati-asset-management-lending', name: 'Cincinnati Asset Management Lending', entityType: 'Lender institution', profilePath: '/lender' };

function counted(records: FixtureRecord[], behavior: Partial<Record<SpecialistHubId, FixtureBehavior>> = {}) {
  const calls: Array<{ hub: SpecialistHubId; name: string; page: number }> = [];
  const base = createFixtureAdapters(records, behavior);
  const adapters = Object.fromEntries(Object.entries(base).map(([hub, adapter]) => [hub, { ...adapter, search: async (name, page, ctx) => { calls.push({ hub: hub as SpecialistHubId, name, page }); return adapter.search(name, page, ctx); } } satisfies HubNameAdapter])) as Record<SpecialistHubId, HubNameAdapter>;
  return { adapters, calls };
}
async function page(query: string, records: FixtureRecord[], behavior: Partial<Record<SpecialistHubId, FixtureBehavior>> = {}, extra: { selectedHub?: string; interpretAs?: string } = {}) {
  const c = counted(records, behavior);
  const state = await resolveAskNameState({ query, plan: planAskResearch(query), ...extra }, { adapters: c.adapters });
  const view = state.mode === 'NAME_RESULTS' ? buildNameResultsView({ query, name: state.response.request.name, scope: state.response.request.hubScope, hubs: state.response.hubs, alternate: state.alternate }) : null;
  return { state, view, calls: c.calls };
}
const isName = (q: string, options: Parameters<typeof decideNameCandidateSearch>[1] = {}) => { const d = decideNameCandidateSearch(q, options); return d.operation === 'NAME_CANDIDATES' ? d : null; };

const FAMILY = ['Cincinnati Asset Management', 'CINCINNATI ASSET MANAGEMENT', 'cincinnati asset management', 'CINCINNATI ASSET MANAGEMENT, INC.', 'Columbus Asset Management', 'Denver Asset Management'];

test('G1. a recognized city inside a supplied organization name does not erase the name (case / legal suffix irrelevant)', () => {
  for (const q of FAMILY) {
    assert.ok(planAskResearch(q).requestedGeography, `precondition: the planner recognizes geography in "${q}"`);
    const d = isName(q); assert.ok(d, `"${q}" must be a name-candidate search`); if (!d) continue;
    assert.equal(d.name, q.replace(/\.$/, ''), 'the COMPLETE supplied name is searched -- the city is not stripped');
    assert.equal(d.hubScope, 'all', 'no hub is required or inferred; the city is not a filter');
    assert.equal(d.alternateCohortInterpretation, true, 'the place/category reading stays available as the explicit labeled action');
    assert.deepEqual(d.unresolvedConditions, [], 'the city is not turned into an office / registration / service-area condition');
  }
  // An explicit user hub selection still scopes; and the API-shaped call (no plan supplied) agrees with the page-shaped call.
  assert.equal(isName('Cincinnati Asset Management', { selectedHub: 'investor' })?.hubScope, 'investor');
  assert.deepEqual(isName('Cincinnati Asset Management'), isName('Cincinnati Asset Management', { plan: planAskResearch('Cincinnati Asset Management') }));
});

test('G2. METAMORPHIC geo-catalog invariant: recognizing the leading place never changes the name decision', () => {
  // Same organization phrase, three planner-geography states: (a) a place the catalog knows today,
  // (b) an unknown token in its position, (c) that unknown token AFTER the catalog learns it -- built
  // from the real plan the planner emits for a known place, so it is exactly what a new state rollout produces.
  const PHRASES: Array<[place: string, rest: string]> = [['Cincinnati', 'Asset Management'], ['Columbus', 'Home Lending'], ['Denver', 'Roofing Company'], ['Austin', 'Wealth Partners']];
  const NEW_PLACE = 'Zentoria';
  for (const [place, rest] of PHRASES) {
    const known = `${place} ${rest}`; const unknown = `${NEW_PLACE} ${rest}`;
    const knownPlan = planAskResearch(known); const unknownPlan = planAskResearch(unknown);
    assert.ok(knownPlan.requestedGeography, `precondition: "${place}" is recognized`); assert.equal(unknownPlan.requestedGeography ?? null, null, `precondition: "${NEW_PLACE}" is not recognized`);
    const learnedPlan = JSON.parse(JSON.stringify(knownPlan).replaceAll(place, NEW_PLACE).replaceAll(place.toLowerCase(), NEW_PLACE.toLowerCase()).replaceAll(place.toUpperCase(), NEW_PLACE.toUpperCase())) as AskResearchPlan;
    assert.equal(learnedPlan.requestedGeography?.city, NEW_PLACE);
    const a = isName(known, { plan: knownPlan }); const b = isName(unknown, { plan: unknownPlan }); const c = isName(unknown, { plan: learnedPlan });
    assert.ok(a && b && c, `"${rest}" led by a place must be a name search in all three catalog states (known=${Boolean(a)} unknown=${Boolean(b)} learned=${Boolean(c)})`);
    if (!a || !b || !c) continue;
    assert.equal(a.name, known); assert.equal(b.name, unknown); assert.equal(c.name, unknown, 'learning the place must not alter the supplied name');
    assert.deepEqual([a.hubScope, b.hubScope, c.hubScope], ['all', 'all', 'all']);
  }
});

test('G3. protected contrasts: explicit geography / cohort / explanation / identifier / journey requests keep their operation', () => {
  const CONTRASTS = [
    'investment advisers in Cincinnati Ohio', 'asset managers in Denver Colorado', 'What does TrustHub know about Cincinnati?', 'roofers in Broward County',
    'nursing homes in Austin Texas', 'moving from Cincinnati to Columbus', 'CRD 104946', 'NMLS 3030', 'USDOT 76235', 'USDOT 99999999', 'Who owns this company?',
    // A place alone is not an organization name; a planner-established cohort ("<place> <provider class>") stays a cohort.
    'Cincinnati', 'Cincinnati Ohio', 'Denver Colorado', 'Denver movers', 'movers Denver', 'Cleveland lenders', 'Columbus nursing homes',
  ];
  for (const q of CONTRASTS) assert.equal(decideNameCandidateSearch(q).operation, 'NOT_NAME_SEARCH', `"${q}" must not become a name search`);
  // The planner's own constraints on real location research are untouched.
  assert.match(planAskResearch('roofers in Broward County').requestedGeography?.display ?? '', /Broward County/);
  assert.equal(planAskResearch('investment advisers in Cincinnati Ohio').intent, 'COHORT_BROWSE');
});

test('G4. the PAGE path: full name reaches every enabled hub once, records stay separate, no hub questionnaire', async () => {
  const { state, view, calls } = await page('Cincinnati Asset Management', [FIRM, OTHER]);
  assert.equal(state.mode, 'NAME_RESULTS'); if (state.mode !== 'NAME_RESULTS' || !view) return;
  assert.equal(state.response.request.name, 'Cincinnati Asset Management'); assert.equal(state.response.request.hubScope, 'all');
  assert.deepEqual(calls.map((c) => c.hub).sort(), [...SPECIALIST_HUB_IDS].sort(), 'network-wide: one dispatch per hub');
  assert.ok(calls.every((c) => c.name === 'Cincinnati Asset Management' && c.page === 1), 'the hubs receive the COMPLETE supplied name, not the name minus its city');
  const keys = state.response.hubs.flatMap((h) => h.candidates.map((c) => c.stableKey));
  assert.ok(keys.some((k) => k.includes('fx-cincinnati-asset-management') && k.startsWith('investor')), 'expected record is INCLUDED (inclusion, not exclusivity)');
  assert.equal(new Set(keys).size, keys.length); assert.equal(keys.length, 2, 'similarly named records in different hubs stay separate candidates');
  for (const c of state.response.hubs.flatMap((h) => h.candidates)) { assert.ok(c.matchedName && c.matchMethod, 'existing match evidence is kept'); assert.doesNotMatch(`${c.recordedLocation ?? ''} ${c.locationMeaning ?? ''}`, /Cincinnati|Ohio/i, 'no inferred company location'); }
  assert.equal(view.kind, 'CANDIDATES'); assert.match(view.heading, /Cincinnati Asset Management/);
  // Explicit hub selection still narrows to exactly that hub.
  const scoped = await page('Cincinnati Asset Management', [FIRM, OTHER], {}, { selectedHub: 'investor' });
  assert.deepEqual(scoped.calls.map((c) => c.hub), ['investor']);
});

test('G5. zero candidates, target failure and incomplete coverage keep the NAME result; the place reading is never auto-dispatched', async () => {
  const miss = await page('Denver Asset Management', []);
  assert.equal(miss.state.mode, 'NAME_RESULTS'); assert.equal(miss.view?.kind, 'COMPLETED_MISS'); assert.match(miss.view!.heading, /Denver Asset Management/);
  assert.equal(miss.calls.length, 6, 'one name dispatch per hub and nothing else -- no cohort / place retrieval');
  assert.ok(miss.view!.alternate, 'the other reading is offered as the explicit labeled action'); assert.match(miss.view!.alternate!.href, /interpret=category/);

  const down = await page('Cincinnati Asset Management', [FIRM], { investor: 'fail' });
  assert.equal(down.state.mode, 'NAME_RESULTS'); assert.equal(down.view?.kind, 'PARTIAL_MISS'); assert.match(down.view!.lead, /Could not be fully searched just now: InvestorTrustHub/);
  assert.equal(down.calls.length, 7, 'six name dispatches plus the single permitted retry of the failed hub'); assert.ok(down.calls.every((c) => c.name === 'Cincinnati Asset Management'));

  const unsupported = await page('Columbus Asset Management', [], { investor: 'unsupported' });
  assert.equal(unsupported.state.mode, 'NAME_RESULTS'); assert.equal(unsupported.view?.kind, 'PARTIAL_MISS');

  // ONLY the customer's explicit click reaches the legacy place/category path.
  const chosen = await page('Cincinnati Asset Management', [FIRM], {}, { interpretAs: 'category' });
  assert.equal(chosen.state.mode, 'LEGACY'); assert.equal(chosen.calls.length, 0);
});
