import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseNetworkAsk } from './ask-parse.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';
import {
  classifyNjHub,
  listNjHubs,
  njReleaseGatePassed,
  njSpecialistUrl,
  NJ_PUBLICATION_MANIFEST,
  NJ_SEMANTIC_GUARDRAILS,
  queryLooksLikeNewJersey,
  routeNjAsk,
  sixHubIdsComplete,
  sixHubReleaseComplete,
} from './nj-network.ts';
import { ASK_CONCIERGE_SYSTEM_PROMPT } from '../ai/system-prompt.ts';
import { SPECIALIST_HUB_IDS } from './registry.ts';

const page = 'app/new-jersey/page.tsx';
const ui = 'components/new-jersey-network-gateway.tsx';
const sitemap = readFileSync('app/sitemap.ts', 'utf8');
const footer = readFileSync('lib/design/ask-design-system.ts', 'utf8');
const gateway = readFileSync(ui, 'utf8');
const pageSrc = readFileSync(page, 'utf8');
const flPage = readFileSync('app/places/florida/page.tsx', 'utf8');
const home = readFileSync('components/network-intelligence-home.tsx', 'utf8');
const verifySrc = readFileSync('scripts/verify-new-jersey-network.mjs', 'utf8');
const placesSrc = readFileSync('app/places/page.tsx', 'utf8');

test('1-6 gateway route, indexable after gate, canonical, sitemap, six cards, no duplicate', () => {
  assert.equal(existsSync(page), true);
  assert.equal(njReleaseGatePassed(), true);
  assert.match(pageSrc, /noIndex: !gate/);
  assert.equal(NJ_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/new-jersey');
  assert.match(pageSrc, /createPageMetadata/);
  assert.match(sitemap, /\/new-jersey/);
  assert.match(sitemap, /njReleaseGatePassed/);
  assert.equal(listNjHubs().length, 6);
  assert.match(gateway, /Specialist New Jersey research/);
  assert.equal(existsSync('app/nj'), false);
  assert.equal(existsSync('app/states/nj'), false);
  assert.equal(existsSync('app/newjersey'), false);
  assert.equal(existsSync('app/new-jersey/[county]'), false);
});

test('7-10 manifest unique hubs and URLs', () => {
  assert.equal(sixHubIdsComplete(), true);
  const ids = listNjHubs().map((h) => h.hub_id);
  assert.equal(new Set(ids).size, 6);
  for (const id of SPECIALIST_HUB_IDS) {
    assert.ok(ids.includes(id), `missing hub ${id}`);
    assert.match(njSpecialistUrl(id), /\/new-jersey$/);
    const row = listNjHubs().find((h) => h.hub_id === id);
    assert.equal(row?.publication_status, 'live');
  }
  assert.equal(classifyNjHub('mortgage denial rate in Bergen County'), 'lender');
  assert.equal(NJ_PUBLICATION_MANIFEST.release_gate.passed, true);
  assert.equal(NJ_PUBLICATION_MANIFEST.release_gate.blocker, null);
});

test('11-18 NJ routing', () => {
  const mover = routeNjAsk('Is this mover licensed in New Jersey?');
  assert.equal(mover?.hubId, 'move');
  assert.equal(mover?.stateCode, 'NJ');
  assert.match(mover!.caveat, /FMCSA/);

  const interstate = parseNetworkAsk('Can this moving company take me from Newark to Florida?');
  assert.equal(interstate.geography?.stateCode, 'NJ');
  assert.ok(interstate.suggestedHubs.includes('move'));
  assert.match(interstate.geography?.meaning ?? '', /FMCSA/);

  const lender = routeNjAsk('What is the mortgage denial rate in Bergen County?');
  assert.equal(lender?.hubId, 'lender');
  const planL = buildNetworkAskPlan('What down payment assistance is available in New Jersey?');
  assert.equal(planL.parsed.geography?.stateCode, 'NJ');
  assert.equal(planL.hubs[0]?.hubId, 'lender');
  assert.equal(planL.placeLensHref, '/new-jersey');

  const ins = routeNjAsk('Is this insurance company authorized in New Jersey?');
  assert.equal(ins?.hubId, 'insurance');
  const senior = routeNjAsk('Find assisted living facilities in Bergen County, New Jersey.');
  assert.equal(senior?.hubId, 'senior');
  const contractor = routeNjAsk('How much construction activity is reported in Middlesex County, New Jersey?');
  assert.equal(contractor?.hubId, 'contractor');
  const investor = routeNjAsk('Find investment advisers in New Jersey.');
  assert.equal(investor?.hubId, 'investor');
  assert.equal(queryLooksLikeNewJersey('New Jersey auto complaint information'), true);
});

test('12-question NJ consumer routing', () => {
  const rows: Array<[string, ReturnType<typeof classifyNjHub>]> = [
    ['Can a New Jersey mover take me to Pennsylvania?', 'move'],
    ['How do I verify a mover for a move inside New Jersey?', 'move'],
    ['What mortgage help is available for a first-time buyer in Camden County, New Jersey?', 'lender'],
    ['What does mortgage denial activity look like in Bergen County?', 'lender'],
    ['Where can I research New Jersey auto insurance complaints?', 'insurance'],
    ['Does a New Jersey financial examination mean an insurer violated the law?', 'insurance'],
    ['Find New Jersey assisted-living information for Morris County.', 'senior'],
    ['What does residents per staff member mean in New Jersey senior care?', 'senior'],
    ['Does New Jersey have statewide permit data for contractors?', 'contractor'],
    ['Can you tell me whether 2.68 million records in New Jersey means 2.68 million projects?', 'contractor'],
    ['What is New Jersey asking investment advisers about AI?', 'investor'],
    ['Can you tell me exactly how many state-registered advisers NJ has?', 'investor'],
  ];
  for (const [q, hub] of rows) {
    const routed = routeNjAsk(q);
    assert.equal(classifyNjHub(q), hub, q);
    assert.equal(routed?.hubId, hub, q);
    assert.equal(routed?.stateCode, 'NJ', q);
    assert.match(routed!.destination, /\/new-jersey$/);
  }
});

test('19-27 semantic guardrails', () => {
  assert.match(NJ_SEMANTIC_GUARDRAILS.missing_ne_zero, /not zero/i);
  assert.match(NJ_SEMANTIC_GUARDRAILS.no_trust_score, /Trust Score/);
  assert.match(NJ_SEMANTIC_GUARDRAILS.no_ranking, /ranking/);
  assert.match(NJ_SEMANTIC_GUARDRAILS.move_ne_fmcsa, /not FMCSA/);
  assert.match(NJ_SEMANTIC_GUARDRAILS.lender_hmda_ne_roster, /not a New Jersey mortgage-license roster/);
  assert.match(NJ_SEMANTIC_GUARDRAILS.insurance_complaint_ne_violation, /not a violation/);
  assert.match(NJ_SEMANTIC_GUARDRAILS.senior_office_ne_service, /not a service area/);
  assert.match(NJ_SEMANTIC_GUARDRAILS.contractor_record_ne_permit, /not 2.68 million permits/);
  assert.match(NJ_SEMANTIC_GUARDRAILS.investor_sec_ne_state_ria, /not the complete New Jersey state-RIA/);
  assert.doesNotMatch(gateway, /Trust Score is/);
  assert.match(gateway, /No Trust Score/);
  assert.doesNotMatch(pageSrc, /AggregateRating|Review'|@type': 'Product/);
  assert.match(pageSrc, /WebPage/);
  assert.match(pageSrc, /BreadcrumbList/);
  assert.match(pageSrc, /ItemList/);
});

test('28-31 six URL definitions; Move or any specialist failure blocks complete', () => {
  for (const id of SPECIALIST_HUB_IDS) {
    assert.ok(
      NJ_PUBLICATION_MANIFEST.hubs.some(
        (h) => h.hub_id === id && h.canonical_state_url.includes('trusthub') && h.canonical_state_url.endsWith('/new-jersey'),
      ),
    );
  }
  const failMove = sixHubReleaseComplete(
    SPECIALIST_HUB_IDS.map((id) => ({
      hub_id: id,
      url: njSpecialistUrl(id),
      http_status: id === 'move' ? 404 : 200,
      ok: id !== 'move',
    })),
  );
  assert.equal(failMove.passed, false);
  assert.deepEqual(failMove.missing, ['move']);

  const failInsurance = sixHubReleaseComplete(
    SPECIALIST_HUB_IDS.map((id) => ({
      hub_id: id,
      url: njSpecialistUrl(id),
      http_status: id === 'insurance' ? 500 : 200,
      ok: id !== 'insurance',
    })),
  );
  assert.equal(failInsurance.passed, false);
  assert.deepEqual(failInsurance.missing, ['insurance']);

  const empty = sixHubReleaseComplete([]);
  assert.equal(empty.passed, false);
  assert.equal(empty.missing.length, 6);

  assert.match(verifySrc, /REQUIRED = \['move', 'lender', 'insurance', 'senior', 'contractor', 'investor'\]/);
  assert.match(verifySrc, /process\.exitCode = 2/);
  assert.match(verifySrc, /selfCanonical/);
  assert.equal(njReleaseGatePassed(), true);
});

test('32-40 Florida and network regression surfaces', () => {
  const fl = parseNetworkAsk('What can TrustHub research in Florida?');
  assert.equal(fl.geography?.stateCode, 'FL');
  const broward = buildNetworkAskPlan('HMDA in Broward County');
  assert.equal(broward.placeLensHref, '/places/florida/broward');
  assert.match(flPage, /floridaPlaceLens/);
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /New Jersey network gateway/);
  assert.match(footer, /\/new-jersey/);
  assert.match(home, /\/new-jersey/);
  assert.match(placesSrc, /\/new-jersey/);
  assert.equal(existsSync('app/promise/page.tsx'), true);
  assert.equal(existsSync('app/methodology/page.tsx'), true);
  assert.equal(existsSync('lib/customer/handoff.ts'), true);
  assert.equal(existsSync('app/api/customer'), true);
  assert.equal(existsSync('components/switch-hub-menu.tsx'), true);
  assert.equal(existsSync('app/claim/layout.tsx'), true);
});

test('accessibility of NJ cards and starters', () => {
  assert.match(gateway, /min-h-11/);
  assert.match(gateway, /overflow-x-clip/);
  assert.match(gateway, /Open \{hub\.hub_name\} New Jersey/);
  assert.match(gateway, /whitespace-normal break-words/);
  assert.doesNotMatch(gateway, /onMouseEnter/);
  assert.match(gateway, /focus-visible:ring-2/);
});
