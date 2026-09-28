import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import matrix from '../../data/network/minnesota/audit-matrices.json' with { type:'json' };
import baseline from '../../data/network/minnesota/baseline.json' with { type:'json' };
import { planAskResearch } from './research-planner.ts';
import { buildAskResearchRoute } from './ask-research-route.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { decideNameCandidateSearch } from './name-candidates/decision.ts';
import { MN_RANKING_REFUSAL, MN_PUBLICATION_MANIFEST as M, MN_PUBLICATION_FINGERPRINT, MN_HUBS, mnReleaseGatePassed, mnPublicationSemanticFingerprint, mnRefusal, mnSpecialistUrl } from './mn-network.ts';
import { normalizedPublishedStatePath } from './published-state-path.ts';
import { askStateSitemapEntries } from './published-ask-states.ts';
import { orchestrateGuidedResearch } from '../guided-research/orchestrator.ts';

test('MN guided handoffs and explicit refusal replay make zero specialist calls', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Minnesota gateway must not fetch specialist records'); };
  try {
    for (const query of ['NMLS 2229 Minnesota','Minnesota DLI QB123456','Rochester MN nursing home','MnDOT 1234','Minnesota NAIC 12345','Minnesota CRD 12345','best Minnesota contractor']) {
      const first = await orchestrateGuidedResearch({action:{type:'START',question:query}});
      const replay = await orchestrateGuidedResearch({session:first.session,action:{type:'EXECUTE'}});
      for (const r of [first,replay]) {
        assert.equal(r.diagnostics.specialistCalls,0);assert.equal(r.result?.executionOccurred,false);assert.deepEqual(r.result?.rows,[]);
        if (query.startsWith('best')) {assert.equal(r.session.researchPlan.executionAllowed,false);assert.deepEqual(r.result?.destinations,[]);}
        else assert.equal(r.result?.destinations[0]?.href,mnSpecialistUrl(r.session.researchPlan.primaryHub!));
      }
    }
  } finally { globalThis.fetch = originalFetch; }
});

const suites = ['routing','identifiers','identifier_priority','ambiguous_license','state_collisions','florida_prefix_regression','prior_state_regression','ranking_refusal'] as const;
type Row = {query:string;expected_hub?:string;identifier_family?:string|null;expected_state?:string|null;expected?:string};
for (const suite of suites) for (const row of matrix[suite] as Row[]) test(`MN matrix / ${suite} / ${row.query}`, () => {
  const actual=JSON.parse(JSON.stringify(planAskResearch(row.query))) as ReturnType<typeof planAskResearch>;
  const before=(baseline.suites[suite] as Array<{query:string;actual:unknown}>).find(r=>r.query===row.query)?.actual;
  if (suite === 'florida_prefix_regression' && row.expected?.startsWith('mn_dli_credential')) {
    assert.equal(actual.identifier?.type,'mn_dli_credential');assert.equal(actual.primaryHub,'contractor');assert.equal(actual.executionMode,'IDENTIFIER');return;
  }
  if (suite === 'florida_prefix_regression' && row.expected?.startsWith('fail_closed')) {
    assert.equal(actual.executionAllowed,false);assert.equal(decideNameCandidateSearch(row.query).operation,'NOT_NAME_SEARCH');return;
  }
  if (suite === 'florida_prefix_regression' || suite === 'prior_state_regression' || row.expected === 'unchanged_current_behavior') {
    assert.deepEqual(actual,before); return;
  }
  if (suite === 'state_collisions') {
    if (row.query === 'Bloomington IN contractor') { assert.deepEqual(actual,before,'documented pre-existing Bloomington IN issue must not worsen'); return; }
    assert.equal(actual.normalizedGeography?.stateCode ?? null,row.expected_state); return;
  }
  if (suite === 'ranking_refusal' || row.expected_hub === 'refuse_ranking') {
    assert.equal(actual.executionAllowed,false); assert.match(actual.clarificationReason ?? '',/does not rank/);
    assert.equal(decideNameCandidateSearch(row.query).operation,'NOT_NAME_SEARCH');
    const plan=buildNetworkAskPlan(row.query); assert.ok(plan.hubs.every(h=>h.capabilityStatus !== 'execute' && !h.options?.length)); return;
  }
  if (row.expected_hub === 'fail_closed' || suite === 'ambiguous_license') {
    assert.equal(actual.executionAllowed,false); assert.equal(decideNameCandidateSearch(row.query).operation,'NOT_NAME_SEARCH'); return;
  }
  if (row.expected_hub === 'reject_cross_hub_total' || row.expected_hub === 'reject_false_headline') {
    assert.equal(actual.executionAllowed,false); assert.ok(mnRefusal(row.query)); return;
  }
  if (row.expected_hub === 'gateway') { assert.equal(actual.primaryHub,undefined);assert.equal(buildNetworkAskPlan(row.query).placeLensHref,'/minnesota');return; }
  assert.equal(actual.primaryHub,row.expected_hub);
  assert.equal(decideNameCandidateSearch(row.query).operation,'NOT_NAME_SEARCH');
  const plan=buildNetworkAskPlan(row.query);
  assert.equal(plan.hubs[0]?.destination,mnSpecialistUrl(actual.primaryHub!));
  if (row.identifier_family) {
    assert.equal(actual.executionMode,'IDENTIFIER'); assert.equal(actual.identifier?.type,row.identifier_family); assert.equal(actual.entityName,undefined);
  }
});

test('MN original matrix contains exactly 203 cases',()=>assert.equal(suites.reduce((n,s)=>n+matrix[s].length,0),203));
test('MN 2229: bare numbers fail closed while labeled NMLS retains exact identity',()=>{
  for(const q of ['2229','2229 Minnesota']) { assert.equal(planAskResearch(q).executionAllowed,false);assert.equal(decideNameCandidateSearch(q).operation,'NOT_NAME_SEARCH'); }
  for(const q of ['NMLS 2229','NMLS 2229 Minnesota']) {const p=planAskResearch(q);assert.equal(p.primaryHub,'lender');assert.equal(p.executionMode,'IDENTIFIER');assert.equal(p.identifier?.value,'2229');}
});
test('MN six certificates, safe summary grains and semantic fingerprint',()=>{
  assert.equal(mnReleaseGatePassed(),true);assert.equal(M.contract,'ath-mn-network-release-v1');
  const drift=structuredClone(M);drift.hubs[0].fingerprint='0'.repeat(64);assert.equal(mnReleaseGatePassed(drift),false);
  assert.equal(M.hubs.length,6);assert.match(MN_PUBLICATION_FINGERPRINT,/^[a-f0-9]{64}$/);
  assert.equal(mnPublicationSemanticFingerprint(JSON.parse(JSON.stringify(M))),MN_PUBLICATION_FINGERPRINT);
  assert.match(M.hubs.find(h=>h.hub_id==='contractor')!.capability_summary,/10,923.*Issued/);
  assert.match(M.hubs.find(h=>h.hub_id==='lender')!.grain,/not a count/);
  assert.match(M.hubs.find(h=>h.hub_id==='senior')!.capability_summary,/1,571/);
  assert.match(M.hubs.find(h=>h.hub_id==='investor')!.capability_summary,/333.*APPROVED/);
});
test('MN independent clocks, canonical links, no graph writes or combined population',()=>{
  assert.deepEqual(M.expansion_ledger.CROSS_HUB_RECORD_TOTAL,{status:'REJECTED',value:null,explanation:'These different source grains cannot be summed.'});
  assert.equal(M.expansion_ledger.ASK_GRAPH_WRITES,0);assert.equal(M.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED,false);assert.equal(M.expansion_ledger.LOCAL_PHASE,'NO');
  for(const id of MN_HUBS){const h=M.hubs.find(h=>h.hub_id===id)!;assert.equal(h.canonical_state_url,mnSpecialistUrl(id));assert.ok(Object.keys(h.source_clocks).length);}
  assert.doesNotMatch(JSON.stringify(M.hubs.map(h=>h.canonical_state_url)),/moving-to|local-lenders|\/hubs\//);
  const page=readFileSync('app/minnesota/page.tsx','utf8'), ui=readFileSync('components/minnesota-network-gateway.tsx','utf8');
  assert.doesNotMatch(page+ui,/['"]Dataset['"]|AggregateRating|ratingValue|createClient|\.insert\(|\.upsert\(/);
  assert.equal((ui.match(/<a href=\{hub.canonical_state_url\}/g)||[]).length,1,'one link per hub, no duplicate routing list');
  assert.equal(normalizedPublishedStatePath('/MINNESOTA'),'/minnesota');assert.equal(normalizedPublishedStatePath('/Minnesota'),'/minnesota');
  assert.equal(askStateSitemapEntries().filter(s=>s.path === '/minnesota').length,1);
});

for (const row of matrix.refusal_scope_regression) test(`MN refusal scope / ${row.query}`, () => {
  if (row.minnesota) {
    assert.match(mnRefusal(row.query) ?? '', /A bare number or unqualified license is ambiguous/);
    assert.equal(planAskResearch(row.query).executionAllowed, false);
    assert.equal(decideNameCandidateSearch(row.query).operation, 'NOT_NAME_SEARCH');
  } else {
    assert.equal(mnRefusal(row.query), undefined);
    assert.doesNotMatch(planAskResearch(row.query).clarificationReason ?? '', /Supply the identifier family/);
  }
});
test('MN leaves generic 2229 on the original network identity-needed route', () => {
  const route = buildAskResearchRoute('2229');
  assert.equal(route.intentLabel, 'One organization \u2014 identity needed');
  assert.equal(route.status, 'I need one detail before I search.');
  assert.equal(route.canExecute, false);
  assert.equal(route.plan.primaryHub, undefined);
  assert.equal(route.plan.normalizedGeography, undefined);
  assert.doesNotMatch(route.explanation, /NMLS 2229|Supply the identifier family/);
});

// ATH-MN-001R2: exercise the full planner/route, not only the keyword predicate.
const rankingVocabulary = ['best', 'safest', 'recommended', 'recommend', 'top rated', 'top-rated',
  'highest rated', 'highest-rated', '#1', 'number one', 'most trustworthy', 'most trusted',
  'Trust Score', 'AggregateRating', 'ratingValue', 'paid ranking', 'sponsored ranking'];
const rankingProviders = ['contractor', 'mortgage lender', 'insurance agency', 'mover', 'assisted living', 'investment adviser'];
for (const term of rankingVocabulary) for (const [index, provider] of rankingProviders.entries()) {
  const query = `${index % 2 ? term.toUpperCase() : term} Minnesota ${provider}`;
  test(`MN ranking execution / ${query}`, () => {
    assert.equal(mnRefusal(query), MN_RANKING_REFUSAL);
    const plan = planAskResearch(query), route = buildAskResearchRoute(query);
    assert.equal(plan.intent, 'RECOMMENDATION_REQUEST');
    assert.equal(plan.executionMode, 'CLARIFY');
    assert.equal(plan.executionAllowed, false);
    assert.equal(plan.clarificationReason, MN_RANKING_REFUSAL);
    assert.equal(route.canExecute, false);
    assert.doesNotMatch(route.status, /research can begin/i);
    assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH');
    assert.ok(buildNetworkAskPlan(query).hubs.every(h => h.capabilityStatus !== 'execute' && !h.options?.length));
  });
}
for (const query of ['recommended Minnesota nursing home', 'most trusted Minnesota lender',
  'paid ranking Minnesota contractors', 'sponsored ranking Minnesota lenders']) {
  test(`MN ranking execution exact reported wording / ${query}`, () => {
    assert.equal(mnRefusal(query), MN_RANKING_REFUSAL);
    const route = buildAskResearchRoute(query);
    assert.equal(route.plan.intent, 'RECOMMENDATION_REQUEST');
    assert.equal(route.plan.executionAllowed, false);
    assert.equal(route.canExecute, false);
    assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH');
  });
}
for (const provider of rankingProviders) test(`MN ordinary research remains available / ${provider}`, () => {
  const query = `Minnesota ${provider}`, route = buildAskResearchRoute(query);
  assert.equal(mnRefusal(query), undefined);
  assert.equal(route.plan.intent, 'COHORT_BROWSE');
  assert.equal(route.plan.executionAllowed, true);
  // Existing care-scope routing keeps assisted living non-executable independently of ranking.
  assert.equal(route.canExecute, provider !== 'assisted living');
  assert.ok(!route.plan.reasonCodes.includes('MINNESOTA_SAFETY_REFUSAL'));
});
for (const term of rankingVocabulary) for (const state of ['', 'Tennessee ']) {
  const query = `${term} ${state}contractor`;
  test(`MN ranking cannot intercept outside Minnesota / ${query}`, () => {
    assert.equal(mnRefusal(query), undefined);
    assert.ok(!planAskResearch(query).reasonCodes.includes('MINNESOTA_SAFETY_REFUSAL'));
  });
}
