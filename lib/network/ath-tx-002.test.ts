import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseNetworkAsk } from './ask-parse.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';
import {
  txReleaseGatePassed,
  txSpecialistUrl,
  txSixHubIdsComplete,
  txSixHubReleaseComplete,
  TX_PUBLICATION_MANIFEST,
  TX_SEMANTIC_GUARDRAILS,
  classifyTxHub,
  listTxHubs,
  queryLooksLikeTexas,
  routeTxAsk,
} from './tx-network.ts';
import { ASK_CONCIERGE_SYSTEM_PROMPT } from '../ai/system-prompt.ts';
import { SPECIALIST_HUB_IDS } from './registry.ts';
import { NJ_PUBLICATION_MANIFEST } from './nj-network.ts';
import { listNjPilotCounties } from './nj-counties.ts';
import { listPlaceLensIndex } from './place-lens.ts';
import { CA_PUBLICATION_MANIFEST } from './ca-network.ts';

const page = 'app/texas/page.tsx';
const ui = 'components/texas-network-gateway.tsx';
const sitemap = readFileSync('app/sitemap.ts', 'utf8');
const footerDs = readFileSync('lib/design/ask-design-system.ts', 'utf8');
const footerSrc = readFileSync('components/footer.tsx', 'utf8');
const gateway = readFileSync(ui, 'utf8');
const pageSrc = readFileSync(page, 'utf8');
const flPage = readFileSync('app/places/florida/page.tsx', 'utf8');
const home = readFileSync('components/network-intelligence-home.tsx', 'utf8');
const verifySrc = readFileSync('scripts/verify-texas-network.mjs', 'utf8');
const placesSrc = readFileSync('app/places/page.tsx', 'utf8');
const prompt = readFileSync('lib/ai/system-prompt.ts', 'utf8');
const stress = JSON.parse(readFileSync('data/network/texas-12-question-stress.json', 'utf8')) as Array<{
  question: string;
  classified_hub: string;
  state: string;
  destination: string;
  source_caveat: string;
}>;

test('gateway route exists, indexable after gate, canonical, sitemap gated, six cards, no counties', () => {
  assert.equal(existsSync(page), true);
  assert.equal(txReleaseGatePassed(), true);
  assert.equal(TX_PUBLICATION_MANIFEST.release_gate.passed, true);
  assert.equal(TX_PUBLICATION_MANIFEST.release_gate.blocker, null);
  assert.match(pageSrc, /noIndex: !gate/);
  assert.equal(TX_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/texas');
  assert.equal(TX_PUBLICATION_MANIFEST.version, 'ath-tx-network-release-v1');
  assert.equal(TX_PUBLICATION_MANIFEST.state_code, 'TX');
  assert.equal(TX_PUBLICATION_MANIFEST.hardcoded_county_routes, false);
  assert.match(pageSrc, /createPageMetadata/);
  assert.match(sitemap, /txReleaseGatePassed/);
  assert.match(sitemap, /\/texas/);
  assert.equal(listTxHubs().length, 6);
  assert.match(gateway, /Specialist Texas research/);
  assert.match(gateway, /Research Texas Providers/);
  assert.equal(existsSync('app/tx'), false);
  assert.equal(existsSync('app/states/tx'), false);
  assert.equal(existsSync('app/places/texas'), false);
  assert.equal(existsSync('app/texas/[county]'), false);
  assert.equal(existsSync('app/texas/austin'), false);
  assert.equal(existsSync('app/texas/houston'), false);
  assert.equal(existsSync('app/texas/harris'), false);
  assert.equal(existsSync('app/texas/travis'), false);
  assert.equal(existsSync('app/texas/tarrant'), false);
  assert.equal(existsSync('app/texas/bexar'), false);
  const extra = readdirSync('app/texas').filter((name) => name !== 'page.tsx');
  assert.deepEqual(extra, []);
  assert.doesNotMatch(gateway, /\/texas\/austin|\/texas\/houston|harris-county|travis-county/);
});

test('manifest unique hubs and specialist /texas URLs', () => {
  assert.equal(txSixHubIdsComplete(), true);
  const ids = listTxHubs().map((h) => h.hub_id);
  assert.equal(new Set(ids).size, 6);
  for (const id of SPECIALIST_HUB_IDS) {
    assert.ok(ids.includes(id), `missing hub ${id}`);
    assert.match(txSpecialistUrl(id), /\/texas$/);
    const row = listTxHubs().find((h) => h.hub_id === id);
    assert.ok(row?.canonical_state_url.endsWith('/texas'));
    assert.ok((row?.verified_facts.length ?? 0) >= 1);
    assert.ok((row?.routing_intents.length ?? 0) >= 2);
    assert.ok((row?.semantic_guardrails.length ?? 0) >= 1);
  }
  const live = listTxHubs().filter((h) => h.publication_status === 'live').map((h) => h.hub_id);
  assert.deepEqual(live.sort(), ['contractor', 'insurance', 'investor', 'lender', 'move', 'senior']);
  const move = listTxHubs().find((h) => h.hub_id === 'move');
  assert.match(move!.coverage_summary, /UNKNOWN/);
  assert.match(move!.verified_facts.join(' '), /SOURCE_NOT_ACQUIRED/);
  assert.doesNotMatch(move!.verified_facts.join(' '), /not yet published/);
  const contractor = listTxHubs().find((h) => h.hub_id === 'contractor');
  assert.match(contractor!.verified_facts.join(' '), /38,915/);
  assert.match(JSON.stringify(TX_PUBLICATION_MANIFEST), /no statewide general-contractor license/i);
});

test('Texas routing keeps hub intent primary and never uses county destinations', () => {
  const contractor = routeTxAsk('Is this Texas electrician licensed?');
  assert.equal(contractor?.hubId, 'contractor');
  assert.equal(contractor?.stateCode, 'TX');
  assert.equal(contractor?.destination, 'https://www.contractortrusthub.com/texas');

  const senior = routeTxAsk('Find senior care in Texas');
  assert.equal(senior?.hubId, 'senior');
  assert.equal(senior?.destination, 'https://www.seniortrusthub.com/texas');

  const lender = routeTxAsk('Texas mortgage activity');
  assert.equal(lender?.hubId, 'lender');

  const insurance = routeTxAsk('Texas insurance appointments');
  assert.equal(insurance?.hubId, 'insurance');
  assert.notEqual(insurance?.hubId, 'contractor');

  const investor = routeTxAsk('Texas adviser');
  assert.equal(investor?.hubId, 'investor');

  const interstate = routeTxAsk('Texas mover to Oklahoma');
  assert.equal(interstate?.hubId, 'move');
  assert.equal(interstate?.destination, 'https://www.movetrusthub.com/texas');
  assert.match(interstate!.caveat, /FMCSA|USDOT/);

  const austinHouston = routeTxAsk('Move from Austin to Houston');
  assert.equal(austinHouston?.hubId, 'move');
  assert.equal(austinHouston?.destination, 'https://www.movetrusthub.com/texas');
  assert.doesNotMatch(austinHouston!.destination, /austin|houston|county/);

  const plan = buildNetworkAskPlan('Move from Austin to Houston');
  assert.equal(plan.parsed.geography?.stateCode, 'TX');
  assert.equal(plan.placeLensHref, '/texas');
  assert.equal(plan.hubs[0]?.destination, 'https://www.movetrusthub.com/texas');
});

test('12-question Texas consumer routing', () => {
  assert.equal(stress.length, 12);
  const hubs = new Set(stress.map((row) => row.classified_hub));
  assert.equal(hubs.size, 6);
  for (const row of stress) {
    assert.equal(classifyTxHub(row.question), row.classified_hub, row.question);
    const routed = routeTxAsk(row.question);
    assert.equal(routed?.hubId, row.classified_hub, row.question);
    assert.equal(routed?.stateCode, row.state, row.question);
    assert.equal(routed?.destination, row.destination, row.question);
    assert.match(routed!.destination, /\/texas$/);
    assert.doesNotMatch(routed!.destination, /county/);
    assert.equal(routed?.caveat, row.source_caveat, row.question);
  }
});

test('semantic guardrails, structured data, no ratings', () => {
  assert.match(TX_SEMANTIC_GUARDRAILS.missing_ne_zero, /not zero/i);
  assert.match(TX_SEMANTIC_GUARDRAILS.no_trust_score, /Trust Score/);
  assert.match(TX_SEMANTIC_GUARDRAILS.no_county_routes, /county/i);
  assert.match(TX_SEMANTIC_GUARDRAILS.contractor_no_gc, /no statewide general-contractor license/);
  assert.match(TX_SEMANTIC_GUARDRAILS.senior_hhsc_ne_cms, /HHSC is not CMS/);
  assert.match(TX_SEMANTIC_GUARDRAILS.insurance_appointment_ne_quality, /Appointment count is not quality/);
  assert.match(TX_SEMANTIC_GUARDRAILS.lender_hmda_ne_roster, /not a Texas mortgage-license roster/);
  assert.match(TX_SEMANTIC_GUARDRAILS.investor_office_ne_ssb, /not Texas state-RIA registration/);
  assert.match(TX_SEMANTIC_GUARDRAILS.move_txdmv_ne_fmcsa, /not FMCSA/);
  assert.match(gateway, /No Trust Score/);
  assert.doesNotMatch(gateway, /Trust Score is/);
  assert.doesNotMatch(pageSrc, /AggregateRating|Review'|@type': 'Product/);
  assert.match(pageSrc, /WebPage/);
  assert.match(pageSrc, /BreadcrumbList/);
  assert.match(pageSrc, /ItemList/);
  assert.match(gateway, /What TrustHub can research/);
  assert.match(gateway, /What the sources do not establish/);
  assert.match(gateway, /row\.display/);
  assert.match(JSON.stringify(TX_PUBLICATION_MANIFEST), /38,915 TDLR business identities/);
  assert.doesNotMatch(gateway, /Texas has 38,915 contractors/);
  assert.match(gateway, /no statewide general-contractor license/);
  assert.match(gateway, /HHSC is not CMS/);
  assert.match(gateway, /not comparable/);
});

test('six URL definitions; Move or any specialist failure blocks complete', () => {
  for (const id of SPECIALIST_HUB_IDS) {
    assert.ok(
      TX_PUBLICATION_MANIFEST.hubs.some(
        (h) => h.hub_id === id && h.canonical_state_url.includes('trusthub') && h.canonical_state_url.endsWith('/texas'),
      ),
    );
  }
  const failMove = txSixHubReleaseComplete(
    SPECIALIST_HUB_IDS.map((id) => ({
      hub_id: id,
      url: txSpecialistUrl(id),
      http_status: id === 'move' ? 404 : 200,
      ok: id !== 'move',
    })),
  );
  assert.equal(failMove.passed, false);
  assert.deepEqual(failMove.missing, ['move']);

  const failInsurance = txSixHubReleaseComplete(
    SPECIALIST_HUB_IDS.map((id) => ({
      hub_id: id,
      url: txSpecialistUrl(id),
      http_status: id === 'insurance' ? 500 : 200,
      ok: id !== 'insurance',
    })),
  );
  assert.equal(failInsurance.passed, false);
  assert.deepEqual(failInsurance.missing, ['insurance']);

  const empty = txSixHubReleaseComplete([]);
  assert.equal(empty.passed, false);
  assert.equal(empty.missing.length, 6);

  assert.match(verifySrc, /REQUIRED = \['move', 'lender', 'insurance', 'senior', 'contractor', 'investor'\]/);
  assert.match(verifySrc, /process\.exitCode = 2/);
  assert.match(verifySrc, /selfCanonical/);
  assert.match(verifySrc, /headlineOk/);
  assert.equal(txReleaseGatePassed(), true);
});

test('homepage, footer, places, concierge, and discovery are gated on the six-hub flag', () => {
  assert.match(footerDs, /\/texas/);
  assert.match(footerSrc, /txReleaseGatePassed/);
  assert.match(home, /txReleaseGatePassed/);
  assert.match(home, /\/texas/);
  assert.match(placesSrc, /listPlaceLensIndex/);
  assert.equal(
    listPlaceLensIndex().some((row) => row.href === '/texas'),
    true,
  );
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /Texas network gateway/);
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /STATE LEVEL ONLY/);
  assert.match(prompt, /Do not copy California or New Jersey metrics/);
  assert.match(prompt, /All six specialist Texas research pages are published/);
  const verification = JSON.parse(readFileSync('data/network/texas-verification.json', 'utf8')) as {
    release_gate_passed: boolean;
    missing: string[];
    blocker: string | null;
  };
  assert.equal(verification.release_gate_passed, true);
  assert.deepEqual(verification.missing, []);
  assert.equal(verification.blocker, null);
  assert.match(readFileSync('app/api/chat/route.ts', 'utf8'), /txConciergeContext/);
  const release = JSON.parse(readFileSync('data/releases/texas-network-release.json', 'utf8')) as {
    version: string;
    fingerprint: string;
    release_gate_passed: boolean;
    stress_pass: boolean;
    hardcoded_county_routes: boolean;
    trust_score: boolean;
  };
  assert.equal(release.version, 'ath-tx-network-release-v1');
  assert.equal(release.release_gate_passed, true);
  assert.equal(release.stress_pass, true);
  assert.equal(release.hardcoded_county_routes, false);
  assert.equal(release.trust_score, false);
  assert.match(release.fingerprint, /^[a-f0-9]{64}$/);
});

test('NJ, Florida, and California public surfaces remain additive and unchanged', () => {
  assert.equal(NJ_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/new-jersey');
  assert.equal(NJ_PUBLICATION_MANIFEST.release_gate.passed, true);
  assert.equal(CA_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/california');
  assert.equal(CA_PUBLICATION_MANIFEST.release_gate.passed, true);
  assert.equal(listNjPilotCounties().length, 4);
  assert.match(sitemap, /\/new-jersey\/monmouth-county/);
  assert.equal(existsSync('app/new-jersey/page.tsx'), true);
  assert.equal(existsSync('app/new-jersey/monmouth-county/page.tsx'), true);
  assert.equal(existsSync('app/places/florida/page.tsx'), true);
  assert.equal(existsSync('app/places/florida/broward/page.tsx'), true);
  assert.equal(existsSync('app/places/florida/palm-beach/page.tsx'), true);
  assert.equal(existsSync('app/california/page.tsx'), true);
  assert.match(flPage, /floridaPlaceLens/);
  const fl = parseNetworkAsk('What can TrustHub research in Florida?');
  assert.equal(fl.geography?.stateCode, 'FL');
  const broward = buildNetworkAskPlan('HMDA in Broward County');
  assert.equal(broward.placeLensHref, '/places/florida/broward');
  const nj = parseNetworkAsk('Is this mover licensed in New Jersey?');
  assert.equal(nj.geography?.stateCode, 'NJ');
  const ca = parseNetworkAsk('How do I verify a California contractor?');
  assert.equal(ca.geography?.stateCode, 'CA');
  const caToTx = buildNetworkAskPlan('California mover to Texas');
  assert.equal(caToTx.parsed.geography?.stateCode, 'CA');
  assert.equal(caToTx.placeLensHref, '/california');
  assert.equal(caToTx.hubs[0]?.destination, 'https://www.movetrusthub.com/california');
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

test('accessibility of TX cards and starters', () => {
  assert.match(gateway, /min-h-11/);
  assert.match(gateway, /overflow-x-clip/);
  assert.match(gateway, /Open \{hub\.hub_name\} Texas/);
  assert.match(gateway, /whitespace-normal break-words/);
  assert.doesNotMatch(gateway, /onMouseEnter/);
  assert.match(gateway, /focus-visible:ring-2/);
});

test('queryLooksLikeTexas does not steal New Jersey, Florida, or California-origin questions', () => {
  assert.equal(queryLooksLikeTexas('Is this mover licensed in New Jersey?'), false);
  assert.equal(queryLooksLikeTexas('HMDA in Broward County'), false);
  assert.equal(queryLooksLikeTexas('How do I verify a California contractor?'), false);
  assert.equal(queryLooksLikeTexas('Is this Texas electrician licensed?'), true);
  assert.equal(queryLooksLikeTexas('What does a TDI complaint index mean?'), true);
  assert.equal(queryLooksLikeTexas('Is Texas HHSC the same as CMS?'), true);
  assert.equal(routeTxAsk('California mover to Texas'), undefined);
  const txToCa = routeTxAsk('Texas mover to California');
  assert.equal(txToCa?.hubId, 'move');
  assert.equal(txToCa?.destination, 'https://www.movetrusthub.com/texas');
});
