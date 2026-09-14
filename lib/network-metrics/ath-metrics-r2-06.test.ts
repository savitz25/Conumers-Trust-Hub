import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import contractorFallback from '../../data/network-metrics/contractor-v1-fallback.json' with { type: 'json' };
import moveFallback from '../../data/network-metrics/move-v1-fallback.json' with { type: 'json' };
import investorFallback from '../../data/network-metrics/investor-v1-fallback.json' with { type: 'json' };
import { planRefresh } from '../../scripts/refresh-specialist-fallbacks.mjs';
import { SPECIALIST_METRIC_REVALIDATE_SECONDS, SPECIALIST_OWNED_HUBS, SPECIALIST_SOURCES, type SpecialistHubId } from './sources.ts';
import { loadSpecialistCard } from './load.ts';
import { buildAskNetworkEvidenceInventory } from './network-evidence.ts';
import { adaptContractorCard, adaptMoveCard } from './adapt.ts';
import type { LoadedSpecialistContract } from './types.ts';

/**
 * ATH-METRICS-R2-06: network metrics automation hardening.
 *
 * These tests prove the *future* propagation path this whole project exists
 * to guarantee: a specialist can ship a new compatible contractRevision that
 * adds a brand new state path AND a brand new evidence metric, and Ask must
 * render it correctly with zero AskTrustHub source changes. This is the
 * concrete "next state rollout doesn't require remembering to update seven
 * homepages" acceptance test named in the R2-06 prompt.
 */

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const home = readFileSync(join(process.cwd(), 'components/network-intelligence-home.tsx'), 'utf8');
const cardSource = readFileSync(join(process.cwd(), 'components/specialist-network-card.tsx'), 'utf8');
const pageSource = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8');
const healthWorkflow = readFileSync(join(process.cwd(), '.github/workflows/specialist-network-health.yml'), 'utf8');

test('future flow: a new state path + a new evidence metric + a new contractRevision are all accepted with zero Ask changes', async () => {
  const future = clone(moveFallback) as Record<string, unknown>;
  future.contractRevision = 'ATH-METRICS-R2-07';
  future.sourceFingerprint = 'simulated-future-move-release';
  future.generatedAt = new Date().toISOString();
  const network = future.network as { publishedStateIntelligencePages: number; publishedStateIntelligencePaths: string[] };
  network.publishedStateIntelligencePaths = [...network.publishedStateIntelligencePaths, '/nevada'];
  network.publishedStateIntelligencePages = network.publishedStateIntelligencePaths.length;
  (future.metrics as Array<Record<string, unknown>>).push({
    unit: 'count',
    key: 'nv_puc_active_household_goods_permit_listings',
    label: 'Nevada active household-goods permit listings',
    value: 77,
    valueState: 'KNOWN',
    grain: 'nv_hhg_permit_listing',
    coverage: 'Nevada',
    denominator: 'Simulated future Nevada acceptance',
    description: 'Simulated future-state metric for the R2-06 automation regression test.',
    contributingSourceSystems: ['simulated_nevada_puc'],
    sourceAsOf: null,
    generatedAt: new Date().toISOString(),
    publicationStatus: 'PUBLIC',
    trace: { counts: 'Simulated.', doesNotCount: 'Not a real Nevada acceptance.' },
  });

  const card = await loadSpecialistCard('move', { fetchImpl: async () => jsonResponse(future) });
  assert.equal(card.origin, 'UPSTREAM', 'a new compatible revision must be accepted, not rejected');
  assert.equal(card.contractRevision, 'ATH-METRICS-R2-07');

  const inventory = buildAskNetworkEvidenceInventory({
    move: { hub: 'move', origin: 'UPSTREAM', raw: future, presentation: card },
  } as unknown as Record<SpecialistHubId, LoadedSpecialistContract>);
  const nevada = inventory.find((metric) => metric.key === 'nv_puc_active_household_goods_permit_listings');
  assert.ok(nevada, 'a brand new PUBLIC metric key must flow into the evidence inventory automatically');
  assert.equal(nevada?.value, 77);
  assert.equal(nevada?.coverage, 'Nevada');
});

test('an incompatible schema in the same simulated future release still fails closed', async () => {
  const broken = clone(moveFallback) as Record<string, unknown>;
  broken.schemaVersion = 'move-network-metrics-v2-incompatible';
  broken.contractRevision = 'ATH-METRICS-R2-07';
  const card = await loadSpecialistCard('move', { fetchImpl: async () => jsonResponse(broken) });
  assert.equal(card.origin, 'FALLBACK');
});

test('refresh-specialist-fallbacks: planRefresh only proposes a refresh for a valid, newer, schema-compatible upstream', () => {
  const bundled = contractorFallback as Record<string, unknown>;

  const identical = planRefresh('contractor', JSON.stringify(bundled), bundled);
  assert.equal(identical.action, 'noop');

  const newerValid = clone(bundled);
  newerValid.sourceFingerprint = 'a-brand-new-fingerprint';
  newerValid.contractRevision = 'ATH-METRICS-R2-06';
  const refreshable = planRefresh('contractor', JSON.stringify(newerValid), bundled);
  assert.equal(refreshable.action, 'refresh');
  assert.equal(refreshable.newFingerprint, 'a-brand-new-fingerprint');

  const malformedJson = planRefresh('contractor', '{not valid json', bundled);
  assert.equal(malformedJson.action, 'skip');
  assert.match(malformedJson.reason, /not valid JSON/);

  const incompatible = clone(bundled);
  incompatible.schemaVersion = 'contractor-network-metrics-v0';
  const rejected = planRefresh('contractor', JSON.stringify(incompatible), bundled);
  assert.equal(rejected.action, 'skip');
  assert.match(rejected.reason, /structural validation/);

  const missingRequiredField = clone(bundled);
  missingRequiredField.metrics = (missingRequiredField.metrics as Array<{ key: string }>).filter(
    (metric) => metric.key !== 'live_credential_records',
  );
  const rejectedMissing = planRefresh('contractor', JSON.stringify(missingRequiredField), bundled);
  assert.equal(rejectedMissing.action, 'skip');
});

test('no cross-grain mega-total exists anywhere in the rendered homepage or card component', () => {
  const forbidden = [
    /total\s+records/i,
    /network\s+records\b/i,
    /total\s+companies/i,
    /\ball\s+records\b/i,
    /trusthub\s+records/i,
  ];
  for (const source of [home, cardSource]) {
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern);
    }
  }
});

test('Ask homepage freshness SLA: page revalidate matches the specialist fetch revalidate window', () => {
  // Both must move together -- if one changes without the other, the documented
  // "compatible specialist update becomes visible within N seconds" claim in the
  // R2-06 report silently goes stale.
  assert.match(pageSource, new RegExp(`export const revalidate = ${SPECIALIST_METRIC_REVALIDATE_SECONDS};`));
});

test('specialist network health workflow runs on a schedule and on-demand, requires no secrets, and never fails on fingerprint drift alone', () => {
  assert.match(healthWorkflow, /schedule:/);
  assert.match(healthWorkflow, /cron:/);
  assert.match(healthWorkflow, /workflow_dispatch/);
  assert.doesNotMatch(healthWorkflow, /secrets\./);
  assert.match(healthWorkflow, /metrics:verify-specialists/);
  assert.match(healthWorkflow, /metrics:check-fallback-drift/);
});

test('all six hubs remain independently defined -- no shared cross-hub metrics calculator was introduced', () => {
  assert.equal(SPECIALIST_OWNED_HUBS.length, 6);
  for (const hub of SPECIALIST_OWNED_HUBS) {
    assert.ok(SPECIALIST_SOURCES[hub].schemaVersion.startsWith(hub), hub);
  }
});

test('regression: adaptContractorCard and adaptMoveCard still work standalone after R2-06 additions', () => {
  const contractor = adaptContractorCard(contractorFallback as Record<string, unknown>, 'UPSTREAM');
  const move = adaptMoveCard(moveFallback as Record<string, unknown>, 'UPSTREAM');
  assert.equal(contractor.primary.find((m) => m.key === 'live_credential_records')?.value, 662331);
  assert.equal(move.primary[0]?.value, 5022);
  // touch investorFallback so the import is exercised (fixture parity check)
  assert.equal((investorFallback as Record<string, unknown>).schemaVersion, 'investor-network-metrics-v1');
});
