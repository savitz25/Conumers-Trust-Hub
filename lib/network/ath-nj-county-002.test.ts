import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseNetworkAsk } from './ask-parse.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { classifyNjHub, queryLooksLikeNewJersey, routeNjAsk } from './nj-network.ts';
import {
  NJ_COUNTY_MANIFEST,
  dedicatedCountyPage,
  detectNjPilotCountySlug,
  listNjPilotCounties,
  njCountyBySlug,
  njCountyPilotComplete,
  njCountySpecialistUrl,
  seniorCountyGatePassed,
} from './nj-counties.ts';
import { ASK_CONCIERGE_SYSTEM_PROMPT } from '../ai/system-prompt.ts';

const sitemap = readFileSync('app/sitemap.ts', 'utf8');
const gateway = readFileSync('components/new-jersey-network-gateway.tsx', 'utf8');
const countyUi = readFileSync('components/new-jersey-county-gateway.tsx', 'utf8');
const countyFacts = readFileSync('lib/network/nj-counties.ts', 'utf8');
const flPage = readFileSync('app/places/florida/page.tsx', 'utf8');

test('four Ask county routes, FIPS, sitemap, no extra NJ counties', () => {
  const rows = listNjPilotCounties();
  assert.equal(rows.length, 4);
  assert.equal(njCountyBySlug('monmouth-county')?.county_fips, '34025');
  assert.equal(njCountyBySlug('middlesex-county')?.county_fips, '34023');
  assert.equal(njCountyBySlug('somerset-county')?.county_fips, '34035');
  assert.equal(njCountyBySlug('union-county')?.county_fips, '34039');
  for (const row of rows) {
    assert.equal(existsSync(`app/new-jersey/${row.county_slug}/page.tsx`), true);
    assert.match(sitemap, new RegExp(row.ask_path.replaceAll('/', '\\/')));
    assert.match(gateway, new RegExp(row.ask_path.replaceAll('/', '\\/')));
  }
  const extra = readdirSync('app/new-jersey').filter(
    (name) => name.endsWith('-county') && !rows.some((r) => r.county_slug === name),
  );
  assert.deepEqual(extra, []);
  assert.equal(existsSync('app/new-jersey/[county]'), false);
  assert.match(gateway, /Four counties currently have deeper local research coverage/);
  assert.doesNotMatch(gateway, /Atlantic County/);
});

test('contractor and lender county handoffs; insurance/move/investor stay state', () => {
  const contractor = routeNjAsk('Show contractor research in Monmouth County NJ');
  assert.equal(contractor?.hubId, 'contractor');
  assert.equal(contractor?.destination, 'https://www.contractortrusthub.com/new-jersey/monmouth-county');

  const lender = routeNjAsk('What mortgage activity do you have for Union County?');
  assert.equal(lender?.hubId, 'lender');
  assert.equal(lender?.destination, 'https://www.lendertrusthub.com/new-jersey/union-county');

  const insurance = routeNjAsk('What insurance complaint data exists in Monmouth County?');
  assert.equal(insurance?.hubId, 'insurance');
  assert.match(insurance!.destination, /insurancetrusthub\.com\/new-jersey/);
  assert.doesNotMatch(insurance!.destination, /monmouth-county/);
  assert.match(insurance!.destination, /county=monmouth/);

  const move = routeNjAsk('Is this mover licensed in Middlesex County?');
  assert.equal(move?.hubId, 'move');
  assert.match(move!.destination, /movetrusthub\.com\/new-jersey/);
  assert.doesNotMatch(move!.destination, /middlesex-county/);

  const investor = routeNjAsk('Find an investment adviser in Union County');
  assert.equal(investor?.hubId, 'investor');
  assert.match(investor!.destination, /investortrusthub\.com\/new-jersey/);
  assert.doesNotMatch(investor!.destination, /union-county/);

  assert.equal(dedicatedCountyPage('insurance', 'monmouth-county'), false);
  assert.equal(dedicatedCountyPage('move', 'somerset-county'), false);
  assert.equal(dedicatedCountyPage('investor', 'union-county'), false);
});

test('senior county links withheld until gate; hub intent stays primary', () => {
  assert.equal(seniorCountyGatePassed(), false);
  const senior = routeNjAsk('Find senior care in Somerset County');
  assert.equal(senior?.hubId, 'senior');
  assert.equal(njCountySpecialistUrl('senior', 'somerset-county').startsWith('https://www.seniortrusthub.com/new-jersey'), true);
  assert.doesNotMatch(njCountySpecialistUrl('senior', 'somerset-county'), /somerset-county/);
  assert.doesNotMatch(countyUi, /https:\/\/www\.seniortrusthub\.com\/new-jersey\/monmouth-county/);
  assert.match(countyUi, /not published yet/);

  assert.equal(classifyNjHub('What insurance research is available for Union County?'), 'insurance');
  assert.notEqual(classifyNjHub('What insurance research is available for Union County?'), 'contractor');
  assert.equal(njCountyPilotComplete(), false);
  assert.equal(NJ_COUNTY_MANIFEST.release_gate.blocker, 'WAITING ON SENIOR COUNTY RELEASE');
});

test('semantics, JSON-LD, concierge, Florida and customer surfaces', () => {
  assert.match(countyFacts, /not permits or projects/);
  assert.match(countyFacts, /not a state contractor license/);
  assert.match(countyFacts, /not a quality score/);
  assert.match(countyFacts, /not a licensed facility/);
  assert.doesNotMatch(countyFacts, /972 licensed contractors/);
  assert.doesNotMatch(countyUi, /Trust Score is/);
  assert.doesNotMatch(countyUi, /AggregateRating/);
  const page = readFileSync('lib/network/nj-county-page.tsx', 'utf8');
  assert.match(page, /WebPage/);
  assert.match(page, /BreadcrumbList/);
  assert.match(page, /ItemList/);
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /Monmouth, Middlesex, Somerset, or Union/);
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /NJSAVI certified vendor is not a licensed contractor/);
  assert.match(flPage, /floridaPlaceLens/);
  assert.equal(existsSync('lib/customer/handoff.ts'), true);
  assert.equal(existsSync('app/api/customer'), true);
  assert.equal(existsSync('app/places/florida/broward/page.tsx'), true);
});

test('federated Ask county detection and place hrefs', () => {
  assert.equal(detectNjPilotCountySlug('Show construction activity in Monmouth County'), 'monmouth-county');
  assert.equal(queryLooksLikeNewJersey('What does mortgage activity look like in Somerset County?'), true);
  const plan = buildNetworkAskPlan('Show contractor research in Monmouth County NJ');
  assert.equal(plan.parsed.geography?.stateCode, 'NJ');
  assert.equal(plan.parsed.geography?.countySlug, 'monmouth-county');
  assert.equal(plan.placeLensHref, '/new-jersey/monmouth-county');
  assert.equal(plan.hubs[0]?.hubId, 'contractor');
  assert.equal(plan.hubs[0]?.destination, 'https://www.contractortrusthub.com/new-jersey/monmouth-county');

  const bergen = buildNetworkAskPlan('What is the mortgage denial rate in Bergen County?');
  assert.equal(bergen.placeLensHref, '/new-jersey');
  assert.match(bergen.hubs[0]?.destination ?? '', /lendertrusthub\.com\/new-jersey$/);

  const broward = buildNetworkAskPlan('HMDA in Broward County');
  assert.equal(broward.placeLensHref, '/places/florida/broward');

  const parsed = parseNetworkAsk('How do I verify a mover for a move inside Middlesex County?');
  assert.equal(parsed.geography?.countySlug, 'middlesex-county');
  assert.ok(parsed.suggestedHubs.includes('move') || classifyNjHub(parsed.query) === 'move');
});
