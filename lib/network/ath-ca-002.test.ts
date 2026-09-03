import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseNetworkAsk } from './ask-parse.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';
import {
  caReleaseGatePassed,
  caSpecialistUrl,
  caSixHubIdsComplete,
  caSixHubReleaseComplete,
  CA_PUBLICATION_MANIFEST,
  CA_SEMANTIC_GUARDRAILS,
  classifyCaHub,
  listCaHubs,
  queryLooksLikeCalifornia,
  routeCaAsk,
} from './ca-network.ts';
import { ASK_CONCIERGE_SYSTEM_PROMPT } from '../ai/system-prompt.ts';
import { SPECIALIST_HUB_IDS } from './registry.ts';
import { NJ_PUBLICATION_MANIFEST } from './nj-network.ts';
import { listNjPilotCounties } from './nj-counties.ts';
import { listPlaceLensIndex } from './place-lens.ts';

const page = 'app/california/page.tsx';
const ui = 'components/california-network-gateway.tsx';
const sitemap = readFileSync('app/sitemap.ts', 'utf8');
const footerDs = readFileSync('lib/design/ask-design-system.ts', 'utf8');
const footerSrc = readFileSync('components/footer.tsx', 'utf8');
const gateway = readFileSync(ui, 'utf8');
const pageSrc = readFileSync(page, 'utf8');
const flPage = readFileSync('app/places/florida/page.tsx', 'utf8');
const home = readFileSync('components/network-intelligence-home.tsx', 'utf8');
const verifySrc = readFileSync('scripts/verify-california-network.mjs', 'utf8');
const placesSrc = readFileSync('app/places/page.tsx', 'utf8');
const prompt = readFileSync('lib/ai/system-prompt.ts', 'utf8');
const stress = JSON.parse(readFileSync('data/network/california-12-question-stress.json', 'utf8')) as Array<{
  question: string;
  classified_hub: string;
  state: string;
  destination: string;
  source_caveat: string;
}>;

test('gateway route exists, indexable after gate, canonical, sitemap gated, six cards, no counties', () => {
  assert.equal(existsSync(page), true);
  assert.equal(caReleaseGatePassed(), true);
  assert.equal(CA_PUBLICATION_MANIFEST.release_gate.passed, true);
  assert.equal(CA_PUBLICATION_MANIFEST.release_gate.blocker, null);
  assert.match(pageSrc, /noIndex: !gate/);
  assert.equal(CA_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/california');
  assert.equal(CA_PUBLICATION_MANIFEST.version, 'ath-ca-network-v1');
  assert.equal(CA_PUBLICATION_MANIFEST.state_code, 'CA');
  assert.equal(CA_PUBLICATION_MANIFEST.hardcoded_county_routes, false);
  assert.match(pageSrc, /createPageMetadata/);
  assert.match(sitemap, /caReleaseGatePassed/);
  assert.match(sitemap, /\/california/);
  assert.equal(listCaHubs().length, 6);
  assert.match(gateway, /Specialist California research/);
  assert.equal(existsSync('app/ca'), false);
  assert.equal(existsSync('app/states/ca'), false);
  assert.equal(existsSync('app/places/california'), false);
  assert.equal(existsSync('app/california/[county]'), false);
  assert.equal(existsSync('app/california/los-angeles-county'), false);
  assert.equal(existsSync('app/california/orange-county'), false);
  assert.equal(existsSync('app/california/san-diego-county'), false);
  const extra = readdirSync('app/california').filter((name) => name !== 'page.tsx');
  assert.deepEqual(extra, []);
  assert.doesNotMatch(gateway, /los-angeles-county|orange-county|san-diego-county/);
});

test('manifest unique hubs and specialist /california URLs', () => {
  assert.equal(caSixHubIdsComplete(), true);
  const ids = listCaHubs().map((h) => h.hub_id);
  assert.equal(new Set(ids).size, 6);
  for (const id of SPECIALIST_HUB_IDS) {
    assert.ok(ids.includes(id), `missing hub ${id}`);
    assert.match(caSpecialistUrl(id), /\/california$/);
    const row = listCaHubs().find((h) => h.hub_id === id);
    assert.ok(row?.canonical_state_url.endsWith('/california'));
    assert.ok((row?.verified_facts.length ?? 0) >= 1);
    assert.ok((row?.routing_intents.length ?? 0) >= 2);
    assert.ok((row?.semantic_guardrails.length ?? 0) >= 1);
  }
  const live = listCaHubs().filter((h) => h.publication_status === 'live').map((h) => h.hub_id);
  assert.deepEqual(live.sort(), ['contractor', 'insurance', 'investor', 'lender', 'move', 'senior']);
  assert.equal(listCaHubs().find((h) => h.hub_id === 'move')?.publication_status, 'live');
  const move = listCaHubs().find((h) => h.hub_id === 'move');
  assert.match(move!.coverage_summary, /SOURCE_NOT_ACQUIRED/);
  assert.match(move!.verified_facts.join(' '), /397/);
  assert.match(move!.verified_facts.join(' '), /132/);
  assert.doesNotMatch(move!.verified_facts.join(' '), /not yet published/);
});

test('California routing keeps hub intent primary and never uses county destinations', () => {
  const contractor = routeCaAsk('How do I verify a California contractor?');
  assert.equal(contractor?.hubId, 'contractor');
  assert.equal(contractor?.stateCode, 'CA');
  assert.equal(contractor?.destination, 'https://www.contractortrusthub.com/california');

  const senior = routeCaAsk('Find senior care in California');
  assert.equal(senior?.hubId, 'senior');
  assert.equal(senior?.destination, 'https://www.seniortrusthub.com/california');

  const lender = routeCaAsk('California mortgage activity');
  assert.equal(lender?.hubId, 'lender');

  const insurance = routeCaAsk('California insurance enforcement');
  assert.equal(insurance?.hubId, 'insurance');
  assert.notEqual(insurance?.hubId, 'contractor');

  const investor = routeCaAsk('California adviser');
  assert.equal(investor?.hubId, 'investor');

  const interstate = routeCaAsk('California mover to Nevada');
  assert.equal(interstate?.hubId, 'move');
  assert.equal(interstate?.destination, 'https://www.movetrusthub.com/california');
  assert.match(interstate!.caveat, /FMCSA|USDOT/);

  const laSf = routeCaAsk('Move from Los Angeles to San Francisco');
  assert.equal(laSf?.hubId, 'move');
  assert.equal(laSf?.destination, 'https://www.movetrusthub.com/california');
  assert.doesNotMatch(laSf!.destination, /los-angeles|county/);

  const plan = buildNetworkAskPlan('Move from Los Angeles to San Francisco');
  assert.equal(plan.parsed.geography?.stateCode, 'CA');
  assert.equal(plan.placeLensHref, '/california');
  assert.equal(plan.hubs[0]?.destination, 'https://www.movetrusthub.com/california');
});

test('12-question California consumer routing', () => {
  assert.equal(stress.length, 12);
  const hubs = new Set(stress.map((row) => row.classified_hub));
  assert.equal(hubs.size, 6);
  for (const row of stress) {
    assert.equal(classifyCaHub(row.question), row.classified_hub, row.question);
    const routed = routeCaAsk(row.question);
    assert.equal(routed?.hubId, row.classified_hub, row.question);
    assert.equal(routed?.stateCode, row.state, row.question);
    assert.equal(routed?.destination, row.destination, row.question);
    assert.match(routed!.destination, /\/california$/);
    assert.doesNotMatch(routed!.destination, /county/);
    assert.equal(routed?.caveat, row.source_caveat, row.question);
  }
});

test('semantic guardrails, structured data, no ratings', () => {
  assert.match(CA_SEMANTIC_GUARDRAILS.missing_ne_zero, /not zero/i);
  assert.match(CA_SEMANTIC_GUARDRAILS.no_trust_score, /Trust Score/);
  assert.match(CA_SEMANTIC_GUARDRAILS.no_county_routes, /county/i);
  assert.match(CA_SEMANTIC_GUARDRAILS.contractor_acquired_ne_universe, /not the complete California contractor universe/);
  assert.match(CA_SEMANTIC_GUARDRAILS.senior_rcfe_ne_snf, /not a nursing home/);
  assert.match(CA_SEMANTIC_GUARDRAILS.insurance_imr_ne_violation, /not a finding that an insurer violated the law/);
  assert.match(CA_SEMANTIC_GUARDRAILS.lender_hmda_ne_roster, /not a California mortgage-license roster/);
  assert.match(CA_SEMANTIC_GUARDRAILS.investor_office_ne_dfpi, /not DFPI/);
  assert.match(CA_SEMANTIC_GUARDRAILS.move_calt_ne_usdot, /not USDOT/);
  assert.match(gateway, /No Trust Score/);
  assert.doesNotMatch(gateway, /Trust Score is/);
  assert.doesNotMatch(pageSrc, /AggregateRating|Review'|@type': 'Product/);
  assert.match(pageSrc, /WebPage/);
  assert.match(pageSrc, /BreadcrumbList/);
  assert.match(pageSrc, /ItemList/);
  assert.match(gateway, /What TrustHub can research/);
  assert.match(gateway, /What the sources do not establish/);
  assert.match(gateway, /75,572 official CSLB public-data rows/);
  assert.match(JSON.stringify(CA_PUBLICATION_MANIFEST), /75,572 official CSLB public-data rows/);
  assert.doesNotMatch(gateway, /California has 75,572 contractors/);
  assert.match(gateway, /An RCFE is not a nursing home/);
  assert.match(gateway, /not all California insurers/);
});

test('six URL definitions; Move or any specialist failure blocks complete', () => {
  for (const id of SPECIALIST_HUB_IDS) {
    assert.ok(
      CA_PUBLICATION_MANIFEST.hubs.some(
        (h) => h.hub_id === id && h.canonical_state_url.includes('trusthub') && h.canonical_state_url.endsWith('/california'),
      ),
    );
  }
  const failMove = caSixHubReleaseComplete(
    SPECIALIST_HUB_IDS.map((id) => ({
      hub_id: id,
      url: caSpecialistUrl(id),
      http_status: id === 'move' ? 404 : 200,
      ok: id !== 'move',
    })),
  );
  assert.equal(failMove.passed, false);
  assert.deepEqual(failMove.missing, ['move']);

  const failInsurance = caSixHubReleaseComplete(
    SPECIALIST_HUB_IDS.map((id) => ({
      hub_id: id,
      url: caSpecialistUrl(id),
      http_status: id === 'insurance' ? 500 : 200,
      ok: id !== 'insurance',
    })),
  );
  assert.equal(failInsurance.passed, false);
  assert.deepEqual(failInsurance.missing, ['insurance']);

  const empty = caSixHubReleaseComplete([]);
  assert.equal(empty.passed, false);
  assert.equal(empty.missing.length, 6);

  assert.match(verifySrc, /REQUIRED = \['move', 'lender', 'insurance', 'senior', 'contractor', 'investor'\]/);
  assert.match(verifySrc, /process\.exitCode = 2/);
  assert.match(verifySrc, /selfCanonical/);
  assert.match(verifySrc, /headlineOk/);
  assert.equal(caReleaseGatePassed(), true);
});

test('homepage, footer, places, concierge, and discovery are gated on the six-hub flag', () => {
  assert.match(footerDs, /\/california/);
  assert.match(footerSrc, /caReleaseGatePassed/);
  assert.match(home, /caReleaseGatePassed/);
  assert.match(home, /\/california/);
  assert.match(placesSrc, /listPlaceLensIndex/);
  assert.equal(
    listPlaceLensIndex().some((row) => row.href === '/california'),
    true,
  );
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /California network gateway/);
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /STATE LEVEL ONLY/);
  assert.match(prompt, /Do not copy New Jersey metrics/);
  assert.match(prompt, /All six specialist California research pages are published/);
  assert.doesNotMatch(prompt, /indexable only after/);
  const verification = JSON.parse(readFileSync('data/network/california-verification.json', 'utf8')) as {
    release_gate_passed: boolean;
    missing: string[];
    blocker: string | null;
  };
  assert.equal(verification.release_gate_passed, true);
  assert.deepEqual(verification.missing, []);
  assert.equal(verification.blocker, null);
  assert.match(readFileSync('app/api/chat/route.ts', 'utf8'), /caConciergeContext/);
});

test('NJ and Florida public surfaces remain additive and unchanged', () => {
  assert.equal(NJ_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/new-jersey');
  assert.equal(NJ_PUBLICATION_MANIFEST.release_gate.passed, true);
  assert.equal(listNjPilotCounties().length, 4);
  assert.match(sitemap, /\/new-jersey\/monmouth-county/);
  assert.equal(existsSync('app/new-jersey/page.tsx'), true);
  assert.equal(existsSync('app/new-jersey/monmouth-county/page.tsx'), true);
  assert.equal(existsSync('app/places/florida/page.tsx'), true);
  assert.equal(existsSync('app/places/florida/broward/page.tsx'), true);
  assert.equal(existsSync('app/places/florida/palm-beach/page.tsx'), true);
  assert.match(flPage, /floridaPlaceLens/);
  const fl = parseNetworkAsk('What can TrustHub research in Florida?');
  assert.equal(fl.geography?.stateCode, 'FL');
  const broward = buildNetworkAskPlan('HMDA in Broward County');
  assert.equal(broward.placeLensHref, '/places/florida/broward');
  const nj = parseNetworkAsk('Is this mover licensed in New Jersey?');
  assert.equal(nj.geography?.stateCode, 'NJ');
});

test('customer / claim identity is not rewritten', () => {
  assert.equal(existsSync('app/promise/page.tsx'), true);
  assert.equal(existsSync('app/methodology/page.tsx'), true);
  assert.equal(existsSync('lib/customer/handoff.ts'), true);
  assert.equal(existsSync('app/api/customer'), true);
  assert.equal(existsSync('components/switch-hub-menu.tsx'), true);
  assert.equal(existsSync('app/claim/layout.tsx'), true);
  assert.equal(existsSync('lib/customer/ath-cust-014a.test.ts'), true);
  assert.equal(existsSync('lib/customer/ath-cust-013a.test.ts'), true);
});

test('accessibility of CA cards and starters', () => {
  assert.match(gateway, /min-h-11/);
  assert.match(gateway, /overflow-x-clip/);
  assert.match(gateway, /Open \{hub\.hub_name\} California/);
  assert.match(gateway, /whitespace-normal break-words/);
  assert.doesNotMatch(gateway, /onMouseEnter/);
  assert.match(gateway, /focus-visible:ring-2/);
});

test('queryLooksLikeCalifornia does not steal New Jersey or generic questions', () => {
  assert.equal(queryLooksLikeCalifornia('Is this mover licensed in New Jersey?'), false);
  assert.equal(queryLooksLikeCalifornia('HMDA in Broward County'), false);
  assert.equal(queryLooksLikeCalifornia('How do I verify a California contractor?'), true);
  assert.equal(queryLooksLikeCalifornia('What does CLEAR mean on CSLB?'), true);
  assert.equal(queryLooksLikeCalifornia('Is an RCFE the same thing as a nursing home?'), true);
});
