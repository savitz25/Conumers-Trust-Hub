import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseNetworkAsk } from './ask-parse.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';
import {
  waReleaseGatePassed,
  waSpecialistUrl,
  waSixHubIdsComplete,
  waSixHubReleaseComplete,
  WA_PUBLICATION_MANIFEST,
  WA_SEMANTIC_GUARDRAILS,
  classifyWaHub,
  listWaHubs,
  queryLooksLikeWashington,
  routeWaAsk,
} from './wa-network.ts';
import { ASK_CONCIERGE_SYSTEM_PROMPT } from '../ai/system-prompt.ts';
import { SPECIALIST_HUB_IDS } from './registry.ts';
import { NJ_PUBLICATION_MANIFEST } from './nj-network.ts';
import { listNjPilotCounties } from './nj-counties.ts';
import { listPlaceLensIndex } from './place-lens.ts';
import { CA_PUBLICATION_MANIFEST } from './ca-network.ts';
import { TX_PUBLICATION_MANIFEST } from './tx-network.ts';

const page = 'app/washington/page.tsx';
const ui = 'components/washington-network-gateway.tsx';
const sitemap = readFileSync('app/sitemap.ts', 'utf8');
const footerDs = readFileSync('lib/design/ask-design-system.ts', 'utf8');
const footerSrc = readFileSync('components/footer.tsx', 'utf8');
const gateway = readFileSync(ui, 'utf8');
const pageSrc = readFileSync(page, 'utf8');
const flPage = readFileSync('app/places/florida/page.tsx', 'utf8');
const home = readFileSync('components/network-intelligence-home.tsx', 'utf8');
const verifySrc = readFileSync('scripts/verify-washington-network.mjs', 'utf8');
const placesSrc = readFileSync('app/places/page.tsx', 'utf8');
const prompt = readFileSync('lib/ai/system-prompt.ts', 'utf8');
const stress = JSON.parse(readFileSync('data/network/washington-12-question-stress.json', 'utf8')) as Array<{
  question: string;
  classified_hub: string;
  state: string;
  destination: string;
  source_caveat: string;
}>;

test('gateway route exists, indexable after gate, canonical, sitemap gated, six cards, no counties', () => {
  assert.equal(existsSync(page), true);
  assert.equal(waReleaseGatePassed(), true);
  assert.equal(WA_PUBLICATION_MANIFEST.release_gate.passed, true);
  assert.equal(WA_PUBLICATION_MANIFEST.release_gate.blocker, null);
  assert.match(pageSrc, /noIndex: !gate/);
  assert.equal(WA_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/washington');
  assert.equal(WA_PUBLICATION_MANIFEST.version, 'ath-wa-network-release-v1');
  assert.equal(WA_PUBLICATION_MANIFEST.state_code, 'WA');
  assert.equal(WA_PUBLICATION_MANIFEST.hardcoded_county_routes, false);
  assert.match(pageSrc, /createPageMetadata/);
  assert.match(sitemap, /waReleaseGatePassed/);
  assert.match(sitemap, /\/washington/);
  assert.equal(listWaHubs().length, 6);
  assert.match(gateway, /Specialist Washington research/);
  assert.match(gateway, /Research Washington Providers/);
  assert.equal(existsSync('app/wa'), false);
  assert.equal(existsSync('app/states/wa'), false);
  assert.equal(existsSync('app/places/washington'), false);
  assert.equal(existsSync('app/washington/[county]'), false);
  assert.equal(existsSync('app/washington/seattle'), false);
  assert.equal(existsSync('app/washington/king'), false);
  assert.equal(existsSync('app/washington/tacoma'), false);
  assert.equal(existsSync('app/washington/pierce'), false);
  assert.equal(existsSync('app/washington/spokane'), false);
  assert.equal(existsSync('app/washington/snohomish'), false);
  assert.equal(existsSync('app/washington/bellevue'), false);
  const extra = readdirSync('app/washington').filter((name) => name !== 'page.tsx');
  assert.deepEqual(extra, []);
  assert.doesNotMatch(gateway, /\/washington\/seattle|\/washington\/king|king-county|pierce-county/);
});

test('manifest unique hubs and specialist /washington URLs', () => {
  assert.equal(waSixHubIdsComplete(), true);
  const ids = listWaHubs().map((h) => h.hub_id);
  assert.equal(new Set(ids).size, 6);
  for (const id of SPECIALIST_HUB_IDS) {
    assert.ok(ids.includes(id), `missing hub ${id}`);
    assert.match(waSpecialistUrl(id), /\/washington$/);
    const row = listWaHubs().find((h) => h.hub_id === id);
    assert.ok(row?.canonical_state_url.endsWith('/washington'));
    assert.ok((row?.verified_facts.length ?? 0) >= 1);
    assert.ok((row?.routing_intents.length ?? 0) >= 2);
    assert.ok((row?.semantic_guardrails.length ?? 0) >= 1);
  }
  const live = listWaHubs()
    .filter((h) => h.publication_status === 'live')
    .map((h) => h.hub_id);
  assert.deepEqual(live.sort(), ['contractor', 'insurance', 'investor', 'lender', 'move', 'senior']);
  const insurance = listWaHubs().find((h) => h.hub_id === 'insurance');
  assert.match(insurance!.verified_facts.join(' '), /2,924/);
  assert.match(insurance!.coverage_summary, /not a live Washington insurer count/);
  const contractor = listWaHubs().find((h) => h.hub_id === 'contractor');
  assert.match(contractor!.verified_facts.join(' '), /160,923/);
  assert.match(JSON.stringify(WA_PUBLICATION_MANIFEST), /not 160,923 net-new companies/i);
});

test('Washington routing keeps hub intent primary and never uses county destinations', () => {
  const contractor = routeWaAsk('Is this Washington contractor registered?');
  assert.equal(contractor?.hubId, 'contractor');
  assert.equal(contractor?.stateCode, 'WA');
  assert.equal(contractor?.destination, 'https://www.contractortrusthub.com/washington');

  const bond = routeWaAsk("Can I see this Washington contractor's bond and insurance records?");
  assert.equal(bond?.hubId, 'contractor');

  const senior = routeWaAsk('How do I find an Adult Family Home in Washington?');
  assert.equal(senior?.hubId, 'senior');
  assert.equal(senior?.destination, 'https://www.seniortrusthub.com/washington');

  const lender = routeWaAsk('How much mortgage activity was reported in Washington?');
  assert.equal(lender?.hubId, 'lender');

  const insurance = routeWaAsk('How do I verify a Washington insurance company?');
  assert.equal(insurance?.hubId, 'insurance');
  assert.notEqual(insurance?.hubId, 'contractor');
  assert.match(insurance!.caveat, /2,924 is not a live/);

  const licensed = routeWaAsk('How many insurance companies are licensed in Washington?');
  assert.equal(licensed?.hubId, 'insurance');
  assert.match(licensed!.caveat, /2,924 is not a live Washington insurer count/);

  const investor = routeWaAsk('Is this Washington investment adviser registered?');
  assert.equal(investor?.hubId, 'investor');

  const interstate = routeWaAsk('Does a USDOT number mean they can move me interstate from Washington?');
  assert.equal(interstate?.hubId, 'move');
  assert.equal(interstate?.destination, 'https://www.movetrusthub.com/washington');
  assert.match(interstate!.caveat, /FMCSA|USDOT/);

  const seattle = routeWaAsk('Washington contractor in Seattle');
  assert.equal(seattle?.hubId, 'contractor');
  assert.equal(seattle?.destination, 'https://www.contractortrusthub.com/washington');
  assert.doesNotMatch(seattle!.destination, /seattle|king|county/);

  const plan = buildNetworkAskPlan('How do I verify a Washington mover?');
  assert.equal(plan.parsed.geography?.stateCode, 'WA');
  assert.equal(plan.placeLensHref, '/washington');
  assert.equal(plan.hubs[0]?.destination, 'https://www.movetrusthub.com/washington');
});

test('12-question Washington consumer routing', () => {
  assert.equal(stress.length, 12);
  const hubs = new Set(stress.map((row) => row.classified_hub));
  assert.equal(hubs.size, 6);
  for (const row of stress) {
    assert.equal(classifyWaHub(row.question), row.classified_hub, row.question);
    const routed = routeWaAsk(row.question);
    assert.equal(routed?.hubId, row.classified_hub, row.question);
    assert.equal(routed?.stateCode, row.state, row.question);
    assert.equal(routed?.destination, row.destination, row.question);
    assert.match(routed!.destination, /\/washington$/);
    assert.doesNotMatch(routed!.destination, /county|seattle|king/);
    assert.equal(routed?.caveat, row.source_caveat, row.question);
  }
});

test('semantic guardrails, structured data, no ratings, expansion ledger', () => {
  assert.match(WA_SEMANTIC_GUARDRAILS.missing_ne_zero, /not zero/i);
  assert.match(WA_SEMANTIC_GUARDRAILS.no_trust_score, /Trust Score/);
  assert.match(WA_SEMANTIC_GUARDRAILS.no_county_routes, /county/i);
  assert.match(WA_SEMANTIC_GUARDRAILS.insurance_2924_ne_live, /2,924 is not a live/);
  assert.match(gateway, /No Trust Score/);
  assert.doesNotMatch(gateway, /Trust Score is/);
  assert.doesNotMatch(pageSrc, /AggregateRating|Review'|@type': 'Product/);
  assert.match(pageSrc, /WebPage/);
  assert.match(pageSrc, /BreadcrumbList/);
  assert.match(pageSrc, /ItemList/);
  assert.match(gateway, /What TrustHub can research/);
  assert.match(gateway, /What the sources do not establish/);
  assert.match(gateway, /row\.display/);
  assert.match(gateway, /Entity growth versus intelligence growth/);
  assert.match(gateway, /Washington data depth/);
  assert.match(JSON.stringify(WA_PUBLICATION_MANIFEST), /UNKNOWN \/ NOT YET AUDITED/);
  assert.equal(WA_PUBLICATION_MANIFEST.expansion_ledger.NET_NEW_CANONICAL_ORGANIZATIONS.value, null);
  assert.equal(WA_PUBLICATION_MANIFEST.expansion_ledger.NEW_PUBLIC_RESEARCH_SURFACES.value, 7);
  assert.doesNotMatch(gateway, /Washington has 160,923 contractors/);
  assert.doesNotMatch(gateway, /2,924 Washington insurance companies/);
});

test('six URL definitions; any specialist failure blocks complete', () => {
  for (const id of SPECIALIST_HUB_IDS) {
    assert.ok(
      WA_PUBLICATION_MANIFEST.hubs.some(
        (h) => h.hub_id === id && h.canonical_state_url.includes('trusthub') && h.canonical_state_url.endsWith('/washington'),
      ),
    );
  }
  const failMove = waSixHubReleaseComplete(
    SPECIALIST_HUB_IDS.map((id) => ({
      hub_id: id,
      url: waSpecialistUrl(id),
      http_status: id === 'move' ? 404 : 200,
      ok: id !== 'move',
    })),
  );
  assert.equal(failMove.passed, false);
  assert.deepEqual(failMove.missing, ['move']);
  const empty = waSixHubReleaseComplete([]);
  assert.equal(empty.passed, false);
  assert.equal(empty.missing.length, 6);
  assert.match(verifySrc, /REQUIRED = \['move', 'lender', 'insurance', 'senior', 'contractor', 'investor'\]/);
  assert.match(verifySrc, /process\.exitCode = 2/);
  assert.match(verifySrc, /selfCanonical/);
  assert.match(verifySrc, /headlineOk/);
  assert.equal(waReleaseGatePassed(), true);
});

test('homepage, footer, places, concierge, and discovery are gated on the six-hub flag', () => {
  assert.match(footerDs, /\/washington/);
  assert.match(footerSrc, /waReleaseGatePassed/);
  assert.match(home, /waReleaseGatePassed/);
  assert.match(home, /\/washington/);
  assert.match(placesSrc, /listPlaceLensIndex/);
  assert.equal(
    listPlaceLensIndex().some((row) => row.href === '/washington'),
    true,
  );
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /Washington network gateway/);
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /STATE LEVEL ONLY/);
  assert.match(prompt, /Do not copy Texas, California, or New Jersey metrics/);
  assert.match(prompt, /All six specialist Washington research pages are published/);
  const verification = JSON.parse(readFileSync('data/network/washington-verification.json', 'utf8')) as {
    release_gate_passed: boolean;
    missing: string[];
    blocker: string | null;
  };
  assert.equal(verification.release_gate_passed, true);
  assert.deepEqual(verification.missing, []);
  assert.equal(verification.blocker, null);
  assert.match(readFileSync('app/api/chat/route.ts', 'utf8'), /waConciergeContext/);
  const release = JSON.parse(readFileSync('data/releases/washington-network-release.json', 'utf8')) as {
    version: string;
    fingerprint: string;
    release_gate_passed: boolean;
    stress_pass: boolean;
    hardcoded_county_routes: boolean;
    trust_score: boolean;
  };
  assert.equal(release.version, 'ath-wa-network-release-v1');
  assert.equal(release.release_gate_passed, true);
  assert.equal(release.stress_pass, true);
  assert.equal(release.hardcoded_county_routes, false);
  assert.equal(release.trust_score, false);
  assert.match(release.fingerprint, /^[a-f0-9]{64}$/);
});

test('NJ, Florida, California, and Texas public surfaces remain additive and unchanged', () => {
  assert.equal(NJ_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/new-jersey');
  assert.equal(NJ_PUBLICATION_MANIFEST.release_gate.passed, true);
  assert.equal(CA_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/california');
  assert.equal(CA_PUBLICATION_MANIFEST.release_gate.passed, true);
  assert.equal(TX_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/texas');
  assert.equal(TX_PUBLICATION_MANIFEST.release_gate.passed, true);
  assert.equal(listNjPilotCounties().length, 4);
  assert.match(sitemap, /\/new-jersey\/monmouth-county/);
  assert.equal(existsSync('app/new-jersey/page.tsx'), true);
  assert.equal(existsSync('app/places/florida/page.tsx'), true);
  assert.equal(existsSync('app/california/page.tsx'), true);
  assert.equal(existsSync('app/texas/page.tsx'), true);
  assert.match(flPage, /floridaPlaceLens/);
  const fl = parseNetworkAsk('What can TrustHub research in Florida?');
  assert.equal(fl.geography?.stateCode, 'FL');
  const ca = parseNetworkAsk('How do I verify a California contractor?');
  assert.equal(ca.geography?.stateCode, 'CA');
  const tx = parseNetworkAsk('Is this Texas electrician licensed?');
  assert.equal(tx.geography?.stateCode, 'TX');
  const caToWa = buildNetworkAskPlan('California mover to Washington');
  assert.equal(caToWa.parsed.geography?.stateCode, 'CA');
  assert.equal(caToWa.placeLensHref, '/california');
});

test('customer / claim identity is not rewritten', () => {
  assert.equal(existsSync('app/promise/page.tsx'), true);
  assert.equal(existsSync('app/methodology/page.tsx'), true);
  assert.equal(existsSync('lib/customer/handoff.ts'), true);
  assert.equal(existsSync('app/api/customer'), true);
  assert.equal(existsSync('components/switch-hub-menu.tsx'), true);
  assert.equal(existsSync('app/claim/layout.tsx'), true);
});

test('accessibility of WA cards and starters', () => {
  assert.match(gateway, /min-h-11/);
  assert.match(gateway, /overflow-x-clip/);
  assert.match(gateway, /Open \{hub\.hub_name\} Washington/);
  assert.match(gateway, /whitespace-normal break-words/);
  assert.doesNotMatch(gateway, /onMouseEnter/);
  assert.match(gateway, /focus-visible:ring-2/);
});

test('queryLooksLikeWashington does not steal other states or DC', () => {
  assert.equal(queryLooksLikeWashington('Is this mover licensed in New Jersey?'), false);
  assert.equal(queryLooksLikeWashington('HMDA in Broward County'), false);
  assert.equal(queryLooksLikeWashington('How do I verify a California contractor?'), false);
  assert.equal(queryLooksLikeWashington('Is this Texas electrician licensed?'), false);
  assert.equal(queryLooksLikeWashington('Washington DC insurance broker'), false);
  assert.equal(queryLooksLikeWashington('Is this Washington contractor registered?'), true);
  assert.equal(queryLooksLikeWashington('How do I find an Adult Family Home in Washington?'), true);
  assert.equal(routeWaAsk('California mover to Washington'), undefined);
  const waToCa = routeWaAsk('Washington mover to California');
  assert.equal(waToCa?.hubId, 'move');
  assert.equal(waToCa?.destination, 'https://www.movetrusthub.com/washington');
});
