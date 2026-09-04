import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseNetworkAsk } from './ask-parse.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';
import {
  azReleaseGatePassed,
  azSpecialistUrl,
  azSixHubIdsComplete,
  azRequiredLiveReleaseComplete,
  AZ_PUBLICATION_MANIFEST,
  AZ_SEMANTIC_GUARDRAILS,
  classifyAzHub,
  listAzHubs,
  queryLooksLikeArizona,
  routeAzAsk,
} from './az-network.ts';
import { ASK_CONCIERGE_SYSTEM_PROMPT } from '../ai/system-prompt.ts';
import { SPECIALIST_HUB_IDS } from './registry.ts';
import { NJ_PUBLICATION_MANIFEST } from './nj-network.ts';
import { listNjPilotCounties } from './nj-counties.ts';
import { listPlaceLensIndex } from './place-lens.ts';
import { CA_PUBLICATION_MANIFEST } from './ca-network.ts';
import { TX_PUBLICATION_MANIFEST } from './tx-network.ts';
import { WA_PUBLICATION_MANIFEST } from './wa-network.ts';
import lenderFallback from '../../data/network-metrics/lender-v1-fallback.json' with { type: 'json' };

const page = 'app/arizona/page.tsx';
const ui = 'components/arizona-network-gateway.tsx';
const sitemap = readFileSync('app/sitemap.ts', 'utf8');
const footerDs = readFileSync('lib/design/ask-design-system.ts', 'utf8');
const footerSrc = readFileSync('components/footer.tsx', 'utf8');
const gateway = readFileSync(ui, 'utf8');
const pageSrc = readFileSync('app/arizona/page.tsx', 'utf8');
const flPage = readFileSync('app/places/florida/page.tsx', 'utf8');
const home = readFileSync('components/network-intelligence-home.tsx', 'utf8');
const placesSrc = readFileSync('app/places/page.tsx', 'utf8');
const prompt = readFileSync('lib/ai/system-prompt.ts', 'utf8');
const stress = JSON.parse(readFileSync('data/network/arizona-12-question-stress.json', 'utf8')) as Array<{
  question: string;
  classified_hub: string;
  state: string;
  destination: string;
}>;
const release = JSON.parse(readFileSync('data/releases/arizona-network-release.json', 'utf8'));

test('gateway route exists, indexable after gate, canonical, sitemap gated, six cards, no counties', () => {
  assert.equal(existsSync(page), true);
  assert.equal(azReleaseGatePassed(), true);
  assert.equal(AZ_PUBLICATION_MANIFEST.release_gate.passed, true);
  assert.equal(AZ_PUBLICATION_MANIFEST.release_gate.blocker, null);
  assert.match(pageSrc, /noIndex: !gate/);
  assert.equal(AZ_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/arizona');
  assert.equal(AZ_PUBLICATION_MANIFEST.version, 'ath-az-network-release-v1');
  assert.equal(AZ_PUBLICATION_MANIFEST.state_code, 'AZ');
  assert.equal(AZ_PUBLICATION_MANIFEST.hardcoded_county_routes, false);
  assert.equal(AZ_PUBLICATION_MANIFEST.arizona_local_phase, 'NO');
  assert.match(pageSrc, /createPageMetadata/);
  assert.match(sitemap, /azReleaseGatePassed/);
  assert.match(sitemap, /\/arizona/);
  assert.equal(listAzHubs().length, 6);
  assert.match(gateway, /Research Arizona Providers/);
  assert.equal(existsSync('app/places/arizona'), false);
  assert.equal(existsSync('app/arizona/phoenix'), false);
  assert.equal(existsSync('app/arizona/maricopa'), false);
  assert.equal(existsSync('app/arizona/tucson'), false);
  assert.equal(existsSync('app/arizona/pima'), false);
  const extra = readdirSync('app/arizona').filter((name) => name !== 'page.tsx');
  assert.deepEqual(extra, []);
  assert.doesNotMatch(gateway, /\/arizona\/phoenix|\/arizona\/maricopa|maricopa-county/);
});

test('four live specialist Arizona URLs; insurance and move are research paths not 404 pages', () => {
  assert.equal(azSixHubIdsComplete(), true);
  assert.equal(azSpecialistUrl('contractor'), 'https://www.contractortrusthub.com/arizona');
  assert.equal(azSpecialistUrl('senior'), 'https://www.seniortrusthub.com/arizona');
  assert.equal(azSpecialistUrl('lender'), 'https://www.lendertrusthub.com/arizona');
  assert.equal(azSpecialistUrl('investor'), 'https://www.investortrusthub.com/arizona');
  assert.equal(azSpecialistUrl('insurance'), 'https://www.insurancetrusthub.com');
  assert.equal(azSpecialistUrl('move'), 'https://www.movetrusthub.com');
  assert.doesNotMatch(azSpecialistUrl('insurance'), /\/arizona$/);
  assert.doesNotMatch(azSpecialistUrl('move'), /\/arizona$/);
  const failLender = azRequiredLiveReleaseComplete(
    (['contractor', 'senior', 'lender', 'investor'] as const).map((id) => ({
      hub_id: id,
      url: azSpecialistUrl(id),
      http_status: id === 'lender' ? 404 : 200,
      ok: id !== 'lender',
    })),
  );
  assert.equal(failLender.passed, false);
  assert.deepEqual(failLender.missing, ['lender']);
});

test('contractor, senior, lender, investor accepted metrics and no fake insurance/move denominators', () => {
  const contractor = AZ_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === 'contractor')!;
  assert.match(contractor.strongest_datasets, /57,886/);
  assert.match(contractor.coverage_limitation, /overlap/i);
  const senior = AZ_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === 'senior')!;
  assert.match(senior.strongest_datasets, /1,719/);
  assert.match(senior.coverage_limitation, /Do not publish one Arizona senior-providers sum/);
  assert.equal(AZ_PUBLICATION_MANIFEST.hmda_clock.applications, 308338);
  assert.equal(AZ_PUBLICATION_MANIFEST.hmda_clock.originations, 183374);
  assert.equal(AZ_PUBLICATION_MANIFEST.hmda_clock.denials, 49721);
  assert.equal(AZ_PUBLICATION_MANIFEST.hmda_clock.denial_rate_pct, 16.13);
  const investor = AZ_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === 'investor')!;
  assert.match(investor.strongest_datasets, /213/);
  assert.match(investor.coverage_limitation, /principal office/i);
  const insurance = AZ_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === 'insurance')!;
  assert.equal(insurance.coverage_type, 'STATE_RESEARCH_PATH');
  assert.match(insurance.coverage_limitation, /No free Arizona agency denominator/);
  assert.match(insurance.strongest_datasets, /not purchased/i);
  const move = AZ_PUBLICATION_MANIFEST.hubs.find((h) => h.hub_id === 'move')!;
  assert.equal(move.coverage_type, 'NO_STATE_LICENSING_UNIVERSE');
  assert.match(AZ_SEMANTIC_GUARDRAILS.move_no_hhg_license, /does not have a household-goods mover/);
  assert.match(AZ_SEMANTIC_GUARDRAILS.insurance_no_fake_count, /UNKNOWN/);
});

test('Ask lender fallback now consumes specialist-owned Arizona HMDA', () => {
  assert.equal(lenderFallback.arizona.hmdaApplications, 308338);
  assert.equal(lenderFallback.arizona.hmdaOriginations, 183374);
  assert.equal(AZ_PUBLICATION_MANIFEST.hmda_clock.supersedes_ask_fallback.applications, 307379);
});

test('expansion ledger does not treat HMDA or 213 overlay as new companies', () => {
  assert.equal(AZ_PUBLICATION_MANIFEST.expansion_ledger.NET_NEW_CANONICAL_ORGANIZATIONS.value, 0);
  assert.equal(AZ_PUBLICATION_MANIFEST.expansion_ledger.NET_NEW_STATE_IDENTITIES.value, 2776);
  assert.equal(AZ_PUBLICATION_MANIFEST.expansion_ledger.EXISTING_ORGANIZATIONS_ENRICHED.value, 544);
  assert.equal(AZ_PUBLICATION_MANIFEST.expansion_ledger.NEW_EVIDENCE_ROWS.do_not_sum, true);
  assert.equal(AZ_PUBLICATION_MANIFEST.expansion_ledger.NEW_PUBLIC_RESEARCH_SURFACES.value, 5);
  assert.equal(AZ_PUBLICATION_MANIFEST.expansion_ledger.per_hub.investor.NET_NEW_CANONICAL_ORGANIZATIONS, 0);
  assert.match(gateway, /Entity growth versus intelligence growth/);
  assert.doesNotMatch(gateway, /Arizona has 57,886 contractors/);
  assert.doesNotMatch(gateway, /213 Arizona licensed advisers/);
});

test('12-question Arizona routing stress test', () => {
  assert.equal(stress.length, 12);
  for (const row of stress) {
    assert.equal(classifyAzHub(row.question), row.classified_hub, row.question);
    const routed = routeAzAsk(row.question);
    assert.ok(routed, row.question);
    assert.equal(routed?.hubId, row.classified_hub, row.question);
    assert.equal(routed?.destination, row.destination, row.question);
    assert.equal(routed?.stateCode, 'AZ');
  }
  const licensed = routeAzAsk('How many insurance agencies are licensed in Arizona?');
  assert.equal(licensed?.hubId, 'insurance');
  assert.match(licensed?.caveat ?? '', /UNKNOWN/);
  const movers = routeAzAsk('Does Arizona license moving companies?');
  assert.match(movers?.caveat ?? '', /does not have a household-goods mover/);
});

test('no Trust Score, ratings schema, or local Arizona routes', () => {
  assert.equal(AZ_PUBLICATION_MANIFEST.trust_score, false);
  assert.equal(AZ_PUBLICATION_MANIFEST.paid_ranking, false);
  assert.match(pageSrc, /WebPage/);
  assert.match(pageSrc, /ItemList/);
  assert.doesNotMatch(pageSrc, /AggregateRating/);
  assert.doesNotMatch(gateway, /Trust Score is/);
  assert.doesNotMatch(gateway, /best adviser|top contractor/i);
});

test('homepage, footer, places, concierge, and discovery are gated on the Arizona flag', () => {
  assert.match(footerDs, /\/arizona/);
  assert.match(footerSrc, /azReleaseGatePassed/);
  assert.match(home, /azReleaseGatePassed/);
  assert.match(home, /\/arizona/);
  assert.match(placesSrc, /listPlaceLensIndex/);
  assert.equal(
    listPlaceLensIndex().some((row) => row.href === '/arizona'),
    true,
  );
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /Arizona network gateway/);
  assert.match(prompt, /NO STATE LICENSING UNIVERSE/);
});

test('WA, TX, CA, NJ, Florida public surfaces remain additive', () => {
  assert.equal(WA_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/washington');
  assert.equal(TX_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/texas');
  assert.equal(CA_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/california');
  assert.equal(NJ_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/new-jersey');
  assert.equal(listNjPilotCounties().length, 4);
  assert.equal(existsSync('app/washington/page.tsx'), true);
  assert.equal(existsSync('app/texas/page.tsx'), true);
  assert.equal(existsSync('app/california/page.tsx'), true);
  assert.equal(existsSync('app/places/florida/page.tsx'), true);
  assert.match(flPage, /floridaPlaceLens/);
  const fl = parseNetworkAsk('What can TrustHub research in Florida?');
  assert.equal(fl.geography?.stateCode, 'FL');
  const az = parseNetworkAsk('Is this Arizona contractor licensed?');
  assert.equal(az.geography?.stateCode, 'AZ');
  const plan = buildNetworkAskPlan('Is this Arizona contractor licensed?');
  assert.equal(plan.parsed.geography?.stateCode, 'AZ');
});

test('queryLooksLikeArizona does not steal other states', () => {
  assert.equal(queryLooksLikeArizona('Is this mover licensed in New Jersey?'), false);
  assert.equal(queryLooksLikeArizona('HMDA in Broward County'), false);
  assert.equal(queryLooksLikeArizona('How do I verify a California contractor?'), false);
  assert.equal(queryLooksLikeArizona('Is this Texas electrician licensed?'), false);
  assert.equal(queryLooksLikeArizona('Is this Washington contractor registered?'), false);
  assert.equal(queryLooksLikeArizona('Is this Arizona contractor licensed?'), true);
  assert.equal(routeAzAsk('California mover to Arizona'), undefined);
  const azToCa = routeAzAsk('Arizona mover to California');
  assert.equal(azToCa?.hubId, 'move');
});

test('customer / claim identity is not rewritten', () => {
  assert.equal(existsSync('app/promise/page.tsx'), true);
  assert.equal(existsSync('lib/customer/handoff.ts'), true);
  assert.equal(existsSync('app/claim/layout.tsx'), true);
});

test('release artifact exists', () => {
  assert.equal(release.version, 'ath-az-network-release-v1');
  assert.equal(release.ask_canonical, 'https://www.asktrusthub.com/arizona');
  assert.match(release.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(release.arizona_local_phase, 'NO');
});
