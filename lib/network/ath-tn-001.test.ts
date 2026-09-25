import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { planAskResearch } from './research-planner.ts';
import { routeMaAsk } from './ma-network.ts';
import { routeGaAsk } from './ga-network.ts';
import { routeOhAsk } from './oh-network.ts';
import {
  ACCEPTED_TN_SPECIALIST_RELEASES,
  REQUIRED_TN_HUB_IDS,
  TN_NETWORK_CONTRACT,
  TN_PUBLICATION_MANIFEST,
  TN_SEMANTIC_GUARDRAILS,
  TN_VERIFICATION,
  classifyTnHub,
  queryLooksLikeTennessee,
  routeTnAsk,
  tnBareLicenseAmbiguous,
  tnConciergeContext,
  tnExactCredentialRoute,
  tnGatewayOnlyQuery,
  tnPublicationSemanticFingerprint,
  tnReleaseGatePassed,
  tennesseeNamedFirst,
} from './tn-network.ts';
import { ASK_NETWORK_STATES } from '../network-metrics/network-evidence.ts';
import { askStateExplorerEyebrow, askStateFooterLinks, askStateSitemapEntries } from './published-ask-states.ts';
import { normalizedPublishedStatePath } from './published-state-path.ts';

const page = readFileSync('app/tennessee/page.tsx', 'utf8');
const gateway = readFileSync('components/tennessee-network-gateway.tsx', 'utf8');
const closeout = JSON.parse(readFileSync('data/network/tennessee/state-closeout.json', 'utf8'));
const release = JSON.parse(readFileSync('data/releases/tennessee-network-release.json', 'utf8'));
const gaps = JSON.parse(readFileSync('data/network/tennessee/gap-register.json', 'utf8'));
const M = TN_PUBLICATION_MANIFEST;

const FROZEN: Record<string, [string, string]> = {
  move: ['b72c3c0aabf0813358a8f622be68f4b2fe4302a4', 'aa892cceecbc7ad96f9e9df43f9f941e5e9df24f6622ff23bc1fb66751d63b69'],
  lender: ['54b11a9c12bf03042f1bb3ff1af60a0005d6d04a', 'cb713c0a555163348f74e4679e66182cd55739b079178a469dd5d39e9ce1d66a'],
  contractor: ['d36047b72a69374514ee32b9aededc36c4318944', 'f9ff8de0df88d4f59ae19efea15aae25cac4ca42a02c4f9439f7d50959a0e680'],
  insurance: ['a52b69d53e408d18f3ef5d64f38d40e57f8e1c41', 'bb82b021809e2deaf5355dd8d30e5d751483f51cb708a9c77bf79fad8eed1bf8'],
  senior: ['e5ba724a9209422e15c80c4d112afba1cd57b1f8', 'f95d81b37f042879e0259bf8d833e0e89122e8a44e55030aa281ca044b047ea9'],
  investor: ['506ba754a21105c309c87757b8f57fdb41e39b34', 'a2332c25eb07803d5e126c0a1935c3e8e0d9268d2fd9f3790e90fce65545f54e'],
};

test('six frozen specialist certificates match the manifest and pass the release gate', () => {
  assert.equal(TN_NETWORK_CONTRACT, 'ath-tn-network-release-v1');
  assert.equal(M.hubs.length, 6);
  assert.deepEqual([...REQUIRED_TN_HUB_IDS].sort(), Object.keys(FROZEN).sort());
  for (const hub of M.hubs) {
    const [sha, fingerprint] = FROZEN[hub.hub_id];
    assert.equal(hub.certified_release_sha, sha, hub.hub_id);
    assert.equal(hub.fingerprint, fingerprint, hub.hub_id);
    assert.equal(hub.specialist_status, 'CLOSED_PRODUCTION_VERIFIED', hub.hub_id);
    assert.equal(hub.canonical_state_url, ACCEPTED_TN_SPECIALIST_RELEASES[hub.hub_id as keyof typeof ACCEPTED_TN_SPECIALIST_RELEASES].canonical_state_url);
    assert.match(hub.canonical_state_url, /^https:\/\/www\.[a-z]+trusthub\.com\/tennessee$/);
  }
  assert.equal(M.release_gate.passed, true);
  assert.equal(M.release_gate.blocker, null);
  assert.equal(tnReleaseGatePassed(), true);
  assert.equal(TN_VERIFICATION.release_gate_passed, true);
  assert.deepEqual(TN_VERIFICATION.pending_certificates, []);
  for (const row of TN_VERIFICATION.hubs) {
    assert.equal(row.http_status, 200, row.hub_id);
    assert.equal(row.selfCanonical, true, row.hub_id);
    assert.match(String(row.robots), /index,\s*follow/i);
    assert.equal(row.sitemap_occurrences, 1, row.hub_id);
    assert.equal(row.rating_schema, false, row.hub_id);
    assert.deepEqual(row.city_route_status, { '/tennessee/nashville': 404 });
  }
});

test('any drifted SHA, fingerprint, URL or pending status fails the gate', () => {
  const clone = () => JSON.parse(JSON.stringify(M));
  for (const mutate of [
    (m: typeof M) => { m.hubs[0].fingerprint = '0'.repeat(64); },
    (m: typeof M) => { m.hubs[1].certified_release_sha = '0'.repeat(40); },
    (m: typeof M) => { m.hubs[2].canonical_state_url = 'https://www.contractortrusthub.com/tennessee/nashville'; },
    (m: typeof M) => { m.hubs[3].specialist_status = 'PENDING_PRODUCTION_CERTIFICATE'; },
    (m: typeof M) => { m.hubs.pop(); },
    (m: typeof M) => { (m as { hardcoded_city_routes: boolean }).hardcoded_city_routes = true; },
  ]) {
    const m = clone();
    mutate(m);
    assert.equal(tnReleaseGatePassed(m), false);
  }
  const verification = JSON.parse(JSON.stringify(TN_VERIFICATION));
  verification.hubs[4].http_status = 404;
  assert.equal(tnReleaseGatePassed(M, verification), false);
});

test('Ask canonical fingerprint controls release; the packet preview hash is informational', () => {
  const fp = tnPublicationSemanticFingerprint();
  assert.equal(closeout.publication_manifest_fingerprint, fp);
  assert.equal(release.ask_fingerprint, fp);
  assert.notEqual(closeout.packet_preview_fingerprint, fp);
  assert.match(closeout.packet_preview_fingerprint_note, /does not control release/);
  const drift = JSON.parse(JSON.stringify(M));
  drift.intelligence_strip[0].display = 'changed';
  assert.notEqual(tnPublicationSemanticFingerprint(drift), fp);
  const volatile = JSON.parse(JSON.stringify(M));
  volatile.release_gate.verified_at = '2030-01-01T00:00:00Z';
  assert.equal(tnPublicationSemanticFingerprint(volatile), fp);
  for (const [hub, [sha, fingerprint]] of Object.entries(FROZEN)) {
    assert.equal(closeout.specialists[hub].certified_release_sha, sha);
    assert.equal(release.specialists[hub].fingerprint, fingerprint);
  }
});

test('no combined Tennessee total, no graph writes, no ranking', () => {
  const ledger = M.expansion_ledger;
  assert.equal(ledger.CROSS_HUB_RECORD_TOTAL.status, 'REJECTED');
  assert.equal(ledger.CROSS_HUB_RECORD_TOTAL.value, null);
  assert.match(ledger.CROSS_HUB_RECORD_TOTAL.explanation, /cannot be summed/);
  assert.equal(ledger.ASK_GRAPH_WRITES, 0);
  assert.equal(ledger.ASK_CLAIM_ELIGIBILITY_BROADENED, false);
  assert.equal(ledger.do_not_sum_hubs, true);
  assert.equal(M.trust_score, false);
  assert.equal(M.paid_ranking, false);
  for (const hub of Object.values(M.hub_expansion_ledgers)) {
    assert.equal(hub.GRAPH_WRITES, 0);
    assert.equal(hub.CLAIM_ELIGIBILITY_BROADENED, false);
  }
  const headlines = [29096, 2029, 326, 327, 302219];
  const numbers = JSON.stringify(M).match(/\d[\d,]*/g)!.map((n) => Number(n.replace(/,/g, '')));
  for (let i = 0; i < headlines.length; i++) {
    for (let j = i + 1; j < headlines.length; j++) assert.equal(numbers.includes(headlines[i] + headlines[j]), false);
  }
  assert.equal(closeout.cross_hub_record_total, null);
  assert.equal(release.cross_hub_record_total.value, null);
  assert.equal(closeout.ask_graph_writes, 0);
  assert.doesNotMatch(page + gateway, /aggregateRating|ratingValue|reviewCount/);
  assert.doesNotMatch(gateway, /best mover|safest adviser|vetted|top-rated/i);
});

test('intelligence strip keeps each denominator label and the certified values', () => {
  const strip = Object.fromEntries(M.intelligence_strip.map((row) => [row.hub_id, row]));
  assert.match(strip.move.display, /framework known, public roster not published/);
  assert.match(strip.move.grain, /repealed effective 2026-03-09/);
  assert.match(strip.contractor.display, /^29,096 Tennessee Contractor license numbers$/);
  assert.doesNotMatch(strip.contractor.display, /29,096 (Tennessee )?contractors\b/i);
  assert.match(strip.insurance.display, /^2,029 distinct NAIC codes on TDCI's List of Licensed Insurance Companies$/);
  assert.match(strip.insurance.grain, /72 placeholder-NAIC/);
  assert.equal(strip.senior.display, '326 HFC Nursing Home licenses');
  assert.equal(strip.investor.display, '327 APPROVED Tennessee state IA firms');
  // Lender HMDA uses the specialist's certified /tennessee value, not the LEI-cell fallback total.
  assert.match(strip.lender.grain, /302,219 applications/);
  assert.doesNotMatch(JSON.stringify(M), /297,?360/);
  assert.equal(M.hub_expansion_ledgers.lender.HMDA_2025_APPLICATIONS, 302219);
  assert.match(TN_SEMANTIC_GUARDRAILS.move_authority_ne_usdot, /not current consumer protections/);
  assert.match(TN_SEMANTIC_GUARDRAILS.contractor_license_ne_contractor, /license numbers, not contractors/);
});

test('gap ledger keeps explicit capability states and missing is not zero', () => {
  assert.equal(gaps.cross_hub_record_total.status, 'REJECTED');
  assert.equal(gaps.cross_hub_record_total.value, null);
  assert.equal(gaps.local_work_needed_now, 'NO');
  const lines: string[] = gaps.remaining_gaps;
  assert.equal(lines.length, 6);
  assert.match(lines.find((l) => l.startsWith('Move:'))!, /roster NOT_ACQUIRED/);
  assert.match(lines.find((l) => l.startsWith('Lender:'))!, /NOT_ACQUIRED/);
  assert.match(lines.find((l) => l.startsWith('Contractor:'))!, /Home Improvement, LLE and LLP rosters NOT_ACQUIRED/);
  assert.match(lines.find((l) => l.startsWith('Insurance:'))!, /agency and producer bulk NOT_ACQUIRED/);
  assert.doesNotMatch(lines.find((l) => l.startsWith('Insurance:'))!, /PENDING/);
  assert.match(lines.find((l) => l.startsWith('Senior:'))!, /Adult Care Home roster NOT_ACQUIRED/);
  assert.match(lines.find((l) => l.startsWith('Senior:'))!, /join UNKNOWN/);
  assert.match(lines.find((l) => l.startsWith('Investor:'))!, /IAR population NOT_ACQUIRED/);
  assert.equal(M.hub_expansion_ledgers.move.TN_AUTHORITY_ROSTER_ROWS, null);
  assert.equal(M.hub_expansion_ledgers.insurance.PRODUCER_BULK, 'NOT_ACQUIRED');
  assert.equal(M.hub_expansion_ledgers.senior.ADULT_CARE_HOME_ROSTER, 'NOT_ACQUIRED');
  assert.equal(M.hub_expansion_ledgers.investor.IAR_POPULATION, 'NOT_ACQUIRED');
});

test('Tennessee routing covers all six hubs with Tennessee caveats', () => {
  const cases: Array<[string, string]> = [
    ['movers Tennessee', 'move'],
    ['moving company Tennessee', 'move'],
    ['intrastate mover Tennessee', 'move'],
    ['Tennessee moving regulations', 'move'],
    ['Tennessee mover', 'move'],
    ['household goods mover Nashville', 'move'],
    ['mortgage lender Tennessee', 'lender'],
    ['mortgage broker Tennessee', 'lender'],
    ['MLO Tennessee', 'lender'],
    ['Tennessee HMDA', 'lender'],
    ['Memphis mortgage lender', 'lender'],
    ['mortgage lender Knoxville', 'lender'],
    ['contractor Tennessee', 'contractor'],
    ['Tennessee contractor', 'contractor'],
    ['Tennessee contractor license', 'contractor'],
    ['home improvement contractor Tennessee', 'contractor'],
    ['HIC Nashville', 'contractor'],
    ['LLE Tennessee', 'contractor'],
    ['LLP Tennessee', 'contractor'],
    ['electrician Tennessee', 'contractor'],
    ['contractor discipline Tennessee', 'contractor'],
    ['insurance company Tennessee', 'insurance'],
    ['insurance agent Tennessee', 'insurance'],
    ['insurance agency Tennessee', 'insurance'],
    ['Nashville insurer', 'insurance'],
    ['Tennessee insurance company actions', 'insurance'],
    ['nursing home Tennessee', 'senior'],
    ['assisted living Tennessee', 'senior'],
    ['ACLF Tennessee', 'senior'],
    ['RHA Tennessee', 'senior'],
    ['home health Tennessee', 'senior'],
    ['hospice Tennessee', 'senior'],
    ['hospice Memphis', 'senior'],
    ['Tennessee senior', 'senior'],
    ['investment adviser Tennessee', 'investor'],
    ['state RIA Tennessee', 'investor'],
    ['ERA Tennessee', 'investor'],
    ['Tennessee notice filing', 'investor'],
    ['Nashville investor', 'investor'],
    ['Tennessee Consent Order', 'investor'],
    ['Tennessee Cease and Desist Order', 'investor'],
    ['broker dealer Tennessee', 'investor'],
  ];
  for (const [question, hub] of cases) {
    const route = routeTnAsk(question);
    assert.equal(route?.hubId, hub, question);
    assert.match(route?.destination ?? '', /trusthub\.com\/tennessee(#[a-z-]+)?$/, question);
    assert.match(route?.caveat ?? '', /not |separate|unknown|repealed/i, question);
    assert.equal(parseNetworkAsk(question).geography?.stateCode, 'TN', question);
    assert.equal(buildNetworkAskPlan(question).hubs[0]?.hubId, hub, question);
  }
  assert.equal(routeTnAsk('HIC Nashville')?.destination, 'https://www.contractortrusthub.com/tennessee#home-improvement');
  assert.equal(routeTnAsk('LLE Tennessee')?.destination, 'https://www.contractortrusthub.com/tennessee#lle');
  assert.equal(routeTnAsk('movers Tennessee')?.destination, 'https://www.movetrusthub.com/tennessee');
  assert.doesNotMatch(routeTnAsk('movers Tennessee')?.destination ?? '', /moving-to/);
  assert.equal(planAskResearch('HIC Nashville').primaryHub, 'contractor');
  assert.equal(planAskResearch('Nashville investor').primaryHub, 'investor');
  assert.equal(planAskResearch('Tennessee senior').primaryHub, 'senior');
  assert.equal(planAskResearch('Tennessee ACLF license 115').primaryHub, 'senior');
  assert.equal(planAskResearch('Tennessee contractor license 1742').primaryHub, 'contractor');
  assert.equal(planAskResearch('SEC 801-12345 Tennessee').primaryHub, 'investor');
  const best = buildNetworkAskPlan('best nursing home Tennessee');
  assert.equal(best.hubs[0]?.hubId, 'senior');
  assert.match(best.hubs[0]?.reason ?? '', /does not select a winner/);
  assert.equal(classifyTnHub('how many businesses in Tennessee'), undefined);
});

test('exact identifiers outrank Tennessee routing', () => {
  for (const q of ['USDOT 125563 Tennessee', 'MC 123456 Tennessee', 'NMLS 2767 Tennessee', 'NAIC 16862 Tennessee', 'NPN 1234567 Tennessee', 'CCN 445483', 'CRD 250 Tennessee', 'SEC 801-12345 Tennessee', 'Tennessee contractor license 1742', 'Tennessee ACLF license 115']) {
    assert.equal(routeTnAsk(q), undefined, q);
  }
  const crd = buildNetworkAskPlan('CRD 250 Tennessee');
  assert.equal(crd.hubs[0]?.hubId, 'investor');
  assert.doesNotMatch(crd.hubs[0]?.destination ?? '', /\/tennessee$/);
  for (const [q, hub] of [['NAIC 16862 Tennessee', 'insurance'], ['USDOT 125563 Tennessee', 'move'], ['NMLS 2767 Tennessee', 'lender'], ['NPN 1234567 Tennessee', 'insurance'], ['MC 123456 Tennessee', 'move']] as const) {
    const plan = buildNetworkAskPlan(q);
    assert.equal(plan.hubs[0]?.hubId, hub, q);
    assert.doesNotMatch(plan.hubs[0]?.destination ?? '', /trusthub\.com\/tennessee$/, q);
    assert.equal(parseNetworkAsk(q).identifier?.family !== undefined || /identifier/.test(String(parseNetworkAsk(q).intent)), true, q);
  }
  const license = tnExactCredentialRoute('Tennessee contractor license 1742');
  assert.equal(license?.hubId, 'contractor');
  assert.equal(license?.destination, 'https://www.contractortrusthub.com/tennessee?license=1742#tn-license-lookup');
  assert.equal(buildNetworkAskPlan('Tennessee contractor license 1742').hubs[0]?.destination, license?.destination);
  const aclf = buildNetworkAskPlan('Tennessee ACLF license 115');
  assert.equal(aclf.hubs[0]?.hubId, 'senior');
  assert.match(aclf.hubs[0]?.destination ?? '', /seniortrusthub\.com\/ask\?q=/);
  const sec = buildNetworkAskPlan('SEC 801-12345 Tennessee');
  assert.equal(sec.hubs[0]?.hubId, 'investor');
  assert.match(sec.hubs[0]?.destination ?? '', /investortrusthub\.com\/ask\?q=/);
});

test('a bare license number fails closed and is never guessed across hubs', () => {
  assert.equal(tnBareLicenseAmbiguous('Tennessee license 115'), true);
  assert.equal(tnBareLicenseAmbiguous('Tennessee ACLF license 115'), false);
  assert.equal(tnBareLicenseAmbiguous('Tennessee contractor license 1742'), false);
  const plan = buildNetworkAskPlan('Tennessee license 115');
  assert.equal(plan.hubs.length, 1);
  assert.equal(plan.hubs[0]?.mode, 'fail_closed');
  assert.equal(plan.hubs[0]?.capabilityStatus, 'unsupported');
  assert.equal(plan.hubs[0]?.destination, undefined);
  assert.match(plan.hubs[0]?.reason ?? '', /ambiguous/);
  assert.equal(planAskResearch('Tennessee license 115').primaryHub, undefined);
  assert.equal(planAskResearch('license 115').primaryHub, undefined);
  assert.equal(buildNetworkAskPlan('license 115').hubs.length, 0);
});

test('gateway-only Tennessee questions claim no specialist', () => {
  assert.equal(tnGatewayOnlyQuery('all Tennessee Trust Hub records'), 'cross_hub_total');
  assert.equal(tnGatewayOnlyQuery('Tennessee complaints'), 'ambiguous_complaints');
  assert.equal(tnGatewayOnlyQuery('insurance complaints Tennessee'), undefined);
  for (const q of ['all Tennessee Trust Hub records', 'Tennessee complaints']) {
    const plan = buildNetworkAskPlan(q);
    assert.equal(plan.hubs.length, 0, q);
    assert.equal(plan.placeLensHref, '/tennessee', q);
  }
});

test('city names are geography and never produce a Tennessee city route', () => {
  assert.equal(existsSync('app/tennessee/nashville'), false);
  assert.equal(existsSync('app/tennessee/memphis'), false);
  assert.equal(existsSync('app/nashville'), false);
  assert.equal(M.hardcoded_city_routes, false);
  assert.equal(M.hardcoded_county_routes, false);
  assert.equal(M.scope, 'STATE_LEVEL_ONLY');
  for (const q of ['contractor Memphis Tennessee', 'HIC Nashville', 'hospice Memphis', 'mortgage lender Knoxville']) {
    const plan = buildNetworkAskPlan(q);
    assert.equal(plan.placeLensHref, '/tennessee', q);
    for (const hub of plan.hubs) assert.doesNotMatch(hub.destination ?? '', /\/tennessee\/[a-z]/, q);
  }
  assert.equal(parseNetworkAsk('Nashville').geography?.stateCode, undefined);
  assert.equal(normalizedPublishedStatePath('/Tennessee'), '/tennessee');
  assert.equal(normalizedPublishedStatePath('/TENNESSEE'), '/tennessee');
  assert.equal(normalizedPublishedStatePath('/tennessee'), null);
  assert.equal(normalizedPublishedStatePath('/Tennessee/nashville'), null);
});

test('state disambiguation: the first named state wins and other states keep their routes', () => {
  assert.equal(parseNetworkAsk('movers Tennessee and Ohio').geography?.stateCode, 'TN');
  assert.equal(parseNetworkAsk('movers Ohio and Tennessee').geography?.stateCode, 'OH');
  assert.equal(parseNetworkAsk('contractor Georgia and Tennessee').geography?.stateCode, 'GA');
  assert.equal(parseNetworkAsk('contractor Tennessee and Georgia').geography?.stateCode, 'TN');
  assert.equal(parseNetworkAsk('nursing homes Tennessee and Massachusetts').geography?.stateCode, 'TN');
  assert.equal(parseNetworkAsk('contractor Washington County Tennessee').geography?.stateCode, 'TN');
  assert.equal(queryLooksLikeTennessee('HIC Nashville GA'), false);
  assert.equal(queryLooksLikeTennessee('contractor Franklin'), false);
  assert.equal(queryLooksLikeTennessee('contractor Franklin Tennessee'), true);
  assert.equal(tennesseeNamedFirst('movers Ohio and Tennessee'), false);
  // Vercel review on #210: a state named only by its code before Tennessee still wins.
  assert.equal(tennesseeNamedFirst('movers CA and Tennessee'), false);
  assert.equal(tennesseeNamedFirst('contractor FL and TN'), false);
  assert.equal(tennesseeNamedFirst('movers TN and CA'), true);
  assert.equal(tennesseeNamedFirst('Medicare Advantage MA plans Tennessee'), true);
  assert.equal(routeTnAsk('movers CA and Tennessee'), undefined);
  assert.equal(queryLooksLikeTennessee('movers CA and Tennessee'), false);
  // The shared geography fallback may still read the full state name; the Tennessee caveat must not apply.
  const caFirst = buildNetworkAskPlan('movers CA and Tennessee');
  assert.doesNotMatch(caFirst.hubs[0]?.reason ?? '', /Intrastate Authority/);
  assert.doesNotMatch(caFirst.hubs[0]?.destination ?? '', /movetrusthub\.com\/tennessee$/);
  assert.equal(routeTnAsk('movers Ohio and Tennessee'), undefined);
  assert.equal(routeOhAsk('investment adviser Tennessee and Ohio'), undefined);
  assert.equal(routeGaAsk('contractor Tennessee and Georgia'), undefined);
  assert.equal(routeMaAsk('HIC Nashville'), undefined);
  assert.equal(routeMaAsk('nursing homes Tennessee and Massachusetts'), undefined);
  assert.equal(routeMaAsk('HIC Massachusetts')?.hubId, 'contractor');
  assert.equal(routeMaAsk('Massachusetts HIC')?.hubId, 'contractor');
  assert.equal(parseNetworkAsk('HIC Massachusetts').geography?.stateCode, 'MA');
  assert.equal(parseNetworkAsk('movers Massachusetts').geography?.stateCode, 'MA');
  assert.equal(parseNetworkAsk('contractors Ohio').geography?.stateCode, 'OH');
  assert.equal(parseNetworkAsk('Georgia insurance agents').geography?.stateCode, 'GA');
});

test('Tennessee is cataloged once, gated, and appended after Massachusetts', () => {
  assert.deepEqual(
    ASK_NETWORK_STATES.map((state) => state.slug),
    ['florida', 'new-jersey', 'california', 'texas', 'washington', 'arizona', 'colorado', 'virginia', 'new-york', 'illinois', 'oregon', 'pennsylvania', 'north-carolina', 'ohio', 'georgia', 'massachusetts', 'tennessee'],
  );
  assert.equal(ASK_NETWORK_STATES.length, 17);
  assert.match(askStateExplorerEyebrow(), /Seventeen-state network explorer/);
  assert.equal(askStateSitemapEntries().filter((entry) => entry.path === '/tennessee').length, 1);
  assert.equal(askStateFooterLinks().filter((link) => link.href === '/tennessee').length, 1);
  assert.equal(M.ask_canonical, 'https://www.asktrusthub.com/tennessee');
  assert.equal(page.includes('noIndex: !gate'), true);
  assert.match(gateway, /Research limitations/);
  assert.match(gateway, /Network routing/);
  assert.match(gateway, /Source clocks/);
  assert.match(gateway, /Trust Score/);
  assert.match(gateway, /What makes Tennessee different/);
});

test('concierge context carries the gate state and every guardrail', () => {
  const context = tnConciergeContext();
  assert.match(context, /gate: passed/);
  for (const line of Object.values(TN_SEMANTIC_GUARDRAILS)) assert.ok(context.includes(line));
  assert.match(readFileSync('app/api/chat/route.ts', 'utf8'), /tnConciergeContext\(\)/);
});

test('closeout stays awaiting Production until the certificate is recorded', () => {
  assert.equal(closeout.local_work_decision, 'NO');
  assert.equal(closeout.cross_hub_record_total_status, 'REJECTED');
  assert.equal(M.status, 'ASK_PUBLICATION_CONTRACT');
  assert.equal(M.ask_production, null);
  assert.equal(M.tennessee_local_phase, 'NO');
  if (closeout.status === 'CLOSED_PRODUCTION_VERIFIED') {
    assert.equal(release.status, 'CLOSED_PRODUCTION_VERIFIED');
    assert.equal(closeout.ask_production.http_status, 200);
    assert.equal(closeout.ask_production.sso, false);
    assert.equal(closeout.ask_production.canonical, 'https://www.asktrusthub.com/tennessee');
    assert.equal(release.ask_production.deployed_sha, closeout.ask_production.merge_sha);
  } else {
    assert.equal(closeout.status, 'AWAITING_PRODUCTION_CERTIFICATE');
    assert.equal(closeout.ask_production, null);
    assert.equal(release.ask_production, null);
  }
});
