import assert from 'node:assert/strict';
import test from 'node:test';
import contractorFallback from '../../data/network-metrics/contractor-v1-fallback.json' with { type: 'json' };
import seniorFallback from '../../data/network-metrics/senior-v1-fallback.json' with { type: 'json' };
import moveFallback from '../../data/network-metrics/move-v1-fallback.json' with { type: 'json' };
import lenderFallback from '../../data/network-metrics/lender-v1-fallback.json' with { type: 'json' };
import insuranceFallback from '../../data/network-metrics/insurance-v1-fallback.json' with { type: 'json' };
import investorFallback from '../../data/network-metrics/investor-v1-fallback.json' with { type: 'json' };
import { FALLBACK_SPECIALIST_FINGERPRINTS, SPECIALIST_OWNED_HUBS, SPECIALIST_SOURCES, type SpecialistHubId } from './sources.ts';
import { loadSpecialistCard, loadSpecialistNetworkCards } from './load.ts';
import { buildAskNetworkEvidenceInventory, buildAskStateCoverage } from './network-evidence.ts';
import {
  adaptContractorCard,
  adaptInsuranceCard,
  adaptInvestorCard,
  adaptLenderCard,
  adaptMoveCard,
  adaptSeniorCard,
} from './adapt.ts';
import type { LoadedSpecialistContract } from './types.ts';

/**
 * ATH-METRICS-R2-05: AskTrustHub must consume the current, Production-verified
 * specialist contracts (ContractorTrustHub R2-02, MoveTrustHub R2-02,
 * SeniorTrustHub R2-03, LenderTrustHub R2-03, InsuranceTrustHub R2-04,
 * InvestorTrustHub R2-04) instead of rejecting them on a pinned sourceFingerprint
 * and silently serving a stale fallback. These tests pin the specific historical
 * regressions named in the R2-05 prompt so they cannot silently reappear.
 */

const FALLBACKS: Record<SpecialistHubId, Record<string, unknown>> = {
  contractor: contractorFallback as Record<string, unknown>,
  senior: seniorFallback as Record<string, unknown>,
  move: moveFallback as Record<string, unknown>,
  lender: lenderFallback as Record<string, unknown>,
  insurance: insuranceFallback as Record<string, unknown>,
  investor: investorFallback as Record<string, unknown>,
};

const ADAPTERS = {
  contractor: adaptContractorCard,
  senior: adaptSeniorCard,
  move: adaptMoveCard,
  lender: adaptLenderCard,
  insurance: adaptInsuranceCard,
  investor: adaptInvestorCard,
} as const;

function metricValue(hub: SpecialistHubId, key: string): unknown {
  const metrics = FALLBACKS[hub].metrics as Array<{ key: string; value: unknown }>;
  return metrics.find((metric) => metric.key === key)?.value;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test('all six current specialist contracts carry their real R2 contractRevision and are accepted', () => {
  const expectedRevision: Record<SpecialistHubId, string> = {
    contractor: 'ATH-METRICS-R2-02',
    move: 'ATH-METRICS-R2-02',
    senior: 'ATH-METRICS-R2-03',
    lender: 'ATH-METRICS-R2-03',
    insurance: 'ATH-METRICS-R2-04',
    investor: 'ATH-METRICS-R2-04',
  };
  for (const hub of SPECIALIST_OWNED_HUBS) {
    assert.equal(FALLBACKS[hub].contractRevision, expectedRevision[hub], hub);
    const card = ADAPTERS[hub](FALLBACKS[hub], 'UPSTREAM');
    assert.equal(card.contractRevision, expectedRevision[hub], hub);
  }
});

test('a newer compatible contractRevision/sourceFingerprint is accepted without an Ask code change', async () => {
  for (const hub of SPECIALIST_OWNED_HUBS) {
    const nextRelease = clone(FALLBACKS[hub]);
    // Simulate the specialist shipping a brand-new compatible release: same schema
    // family, new sourceFingerprint, new contractRevision. This must be accepted
    // as UPSTREAM, never rejected merely because the fingerprint/revision string
    // differs from what is bundled in the fallback snapshot.
    nextRelease.sourceFingerprint = `simulated-future-release-${hub}`;
    nextRelease.contractRevision = 'ATH-METRICS-R2-06';
    nextRelease.generatedAt = new Date().toISOString();
    const card = await loadSpecialistCard(hub, { fetchImpl: async () => jsonResponse(nextRelease) });
    assert.equal(card.origin, 'UPSTREAM', `${hub} should accept a new compatible release, not fall back`);
    assert.notEqual(card.fingerprint, FALLBACK_SPECIALIST_FINGERPRINTS[hub], `${hub} fingerprint should reflect the new release`);
    assert.equal(card.contractRevision, 'ATH-METRICS-R2-06', hub);
  }
});

test('an unsupported schemaVersion still fails closed to the fallback for every hub', async () => {
  for (const hub of SPECIALIST_OWNED_HUBS) {
    const incompatible = clone(FALLBACKS[hub]);
    incompatible.schemaVersion = `${SPECIALIST_SOURCES[hub].schemaVersion}-INCOMPATIBLE`;
    const card = await loadSpecialistCard(hub, { fetchImpl: async () => jsonResponse(incompatible) });
    assert.equal(card.origin, 'FALLBACK', `${hub} must fail closed on an incompatible schema, not render it`);
  }
});

test('all six hubs load as UPSTREAM together when every upstream is healthy', async () => {
  const cards = await loadSpecialistNetworkCards({
    fetchImpl: async (url) => {
      const hub = (SPECIALIST_OWNED_HUBS as SpecialistHubId[]).find((candidate) => SPECIALIST_SOURCES[candidate].publicationUrl === url);
      if (!hub) throw new Error(`unexpected fetch url in test: ${url}`);
      const release = clone(FALLBACKS[hub]);
      release.sourceFingerprint = `healthy-${hub}`;
      return jsonResponse(release);
    },
  });
  for (const hub of SPECIALIST_OWNED_HUBS) {
    assert.equal(cards[hub].origin, 'UPSTREAM', hub);
  }
});

test('Contractor: the fixed 662,331 partition cannot regress to a historical partial value', () => {
  assert.equal(metricValue('contractor', 'live_credential_records'), 662331);
  assert.notEqual(metricValue('contractor', 'live_credential_records'), 644421);
  assert.notEqual(metricValue('contractor', 'live_credential_records'), 652357);
});

test('Lender: current Florida Approved 6,392 is served, not the historical 6,394', () => {
  assert.equal(metricValue('lender', 'florida_ofr_approved_company_credentials'), 6392);
  assert.notEqual(metricValue('lender', 'florida_ofr_approved_company_credentials'), 6394);
  const card = adaptLenderCard(FALLBACKS.lender, 'UPSTREAM');
  const inventory = buildAskNetworkEvidenceInventory({
    lender: { hub: 'lender', origin: 'UPSTREAM', raw: FALLBACKS.lender, presentation: card },
  } as unknown as Record<SpecialistHubId, LoadedSpecialistContract>);
  assert.equal(inventory.some((metric) => metric.value === 6394), false);
  // The confirmed-NMLS bridge measure (6,265) is INTERNAL and must not surface as a
  // public Ask evidence measure or be confused with the public Approved count.
  assert.equal(inventory.some((metric) => metric.key === 'florida_confirmed_nmls_identities'), false);
});

test('Move: Illinois and New York current HHG rosters stay null, never zero', () => {
  assert.equal(metricValue('move', 'il_current_hhg_roster'), null);
  assert.equal(metricValue('move', 'ny_current_hhg_roster'), null);
  const inventory = buildAskNetworkEvidenceInventory({
    move: { hub: 'move', origin: 'UPSTREAM', raw: FALLBACKS.move, presentation: adaptMoveCard(FALLBACKS.move, 'UPSTREAM') },
  } as unknown as Record<SpecialistHubId, LoadedSpecialistContract>);
  const il = inventory.find((metric) => metric.key === 'il_current_hhg_roster');
  assert.ok(il, 'Illinois roster measure must still be exported for search-only visibility');
  assert.equal(il?.value, null);
  assert.equal(il?.valueState, 'UNKNOWN');
});

test('Move: nine published state-intelligence paths are accepted (compatible growth, not a schema break)', () => {
  const network = FALLBACKS.move.network as { publishedStateIntelligencePages: number; publishedStateIntelligencePaths: string[] };
  assert.equal(network.publishedStateIntelligencePaths.length, 9);
  assert.equal(network.publishedStateIntelligencePages, 9);
});

test('Move: dropping a previously accepted state page fails closed instead of silently shrinking coverage', async () => {
  const regressed = clone(FALLBACKS.move);
  const network = regressed.network as { publishedStateIntelligencePaths: string[]; publishedStateIntelligencePages: number };
  network.publishedStateIntelligencePaths = network.publishedStateIntelligencePaths.filter((path) => path !== '/colorado');
  network.publishedStateIntelligencePages = network.publishedStateIntelligencePaths.length;
  const card = await loadSpecialistCard('move', { fetchImpl: async () => jsonResponse(regressed) });
  assert.equal(card.origin, 'FALLBACK');
});

test('Insurance: Illinois Director\'s Order observations never inflate agency or insurer identity totals', () => {
  assert.equal(metricValue('insurance', 'il_directors_order_observations'), 2896);
  assert.equal(metricValue('insurance', 'insurance_agencies'), 82071);
  assert.equal(metricValue('insurance', 'licensed_insurance_companies'), 6185);
  const inventory = buildAskNetworkEvidenceInventory({
    insurance: { hub: 'insurance', origin: 'UPSTREAM', raw: FALLBACKS.insurance, presentation: adaptInsuranceCard(FALLBACKS.insurance, 'UPSTREAM') },
  } as unknown as Record<SpecialistHubId, LoadedSpecialistContract>);
  const order = inventory.find((metric) => metric.key === 'il_directors_order_observations');
  assert.ok(order);
  assert.equal(order?.value, 2896);
  assert.equal(inventory.some((metric) => metric.value === 82071 + 2896), false);
  assert.equal(inventory.some((metric) => metric.value === 6185 + 2896), false);
});

test('Investor: state registration/notice filings never inflate the canonical firm count', () => {
  assert.equal(metricValue('investor', 'investment_advisory_firms'), 23622);
  assert.notEqual(metricValue('investor', 'investment_advisory_firms'), 25777);
});

test('fallback provenance: origin, fingerprint, and generatedAt are preserved, never presented as current', async () => {
  const card = await loadSpecialistCard('contractor', { fetchImpl: async () => { throw new Error('upstream unavailable'); } });
  assert.equal(card.origin, 'FALLBACK');
  assert.equal(card.fingerprint, FALLBACK_SPECIALIST_FINGERPRINTS.contractor);
  // The fallback's own generatedAt clock must survive untouched -- it must never be
  // rewritten to "now" to make a degraded response look fresh.
  assert.equal(card.generatedAt, String(FALLBACKS.contractor.generatedAt));
  assert.notEqual(card.generatedAt.slice(0, 10), new Date().toISOString().slice(0, 10));
});

test('deterministic aggregation: identical inputs produce identical inventory and state coverage output', () => {
  const contracts = Object.fromEntries(
    SPECIALIST_OWNED_HUBS.map((hub) => [hub, { hub, origin: 'FALLBACK', raw: FALLBACKS[hub], presentation: ADAPTERS[hub](FALLBACKS[hub], 'FALLBACK') }]),
  ) as unknown as Record<SpecialistHubId, LoadedSpecialistContract>;
  const inventoryA = buildAskNetworkEvidenceInventory(contracts);
  const inventoryB = buildAskNetworkEvidenceInventory(contracts);
  assert.deepEqual(inventoryA, inventoryB);
  const coverageA = buildAskStateCoverage(contracts);
  const coverageB = buildAskStateCoverage(contracts);
  assert.deepEqual(coverageA, coverageB);
});

test('bundled fallback fingerprints stay self-consistent with sources.ts (refresh both together)', () => {
  for (const hub of SPECIALIST_OWNED_HUBS) {
    assert.equal(FALLBACKS[hub].sourceFingerprint, FALLBACK_SPECIALIST_FINGERPRINTS[hub], hub);
  }
});
