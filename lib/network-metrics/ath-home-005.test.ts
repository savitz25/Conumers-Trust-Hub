import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import contractor from '../../data/network-metrics/contractor-v1-fallback.json' with { type: 'json' };
import senior from '../../data/network-metrics/senior-v1-fallback.json' with { type: 'json' };
import move from '../../data/network-metrics/move-v1-fallback.json' with { type: 'json' };
import lender from '../../data/network-metrics/lender-v1-fallback.json' with { type: 'json' };
import insurance from '../../data/network-metrics/insurance-v1-fallback.json' with { type: 'json' };
import investor from '../../data/network-metrics/investor-v1-fallback.json' with { type: 'json' };
import coverageArtifact from '../../data/network-intelligence/network-coverage-v1.json' with { type: 'json' };
import { adaptContractorCard, adaptInsuranceCard, adaptInvestorCard, adaptLenderCard, adaptMoveCard, adaptSeniorCard } from './adapt.ts';
import { buildAskNetworkEvidenceInventory, buildAskStateCoverage, NETWORK_EVIDENCE_FAMILY_LABELS } from './network-evidence.ts';
import { ACCEPTED_SPECIALIST_FINGERPRINTS, SPECIALIST_OWNED_HUBS, type SpecialistHubId } from './sources.ts';
import type { LoadedSpecialistContract } from './types.ts';

const raws = { move, lender, insurance, contractor, senior, investor } as unknown as Record<SpecialistHubId, Record<string, unknown>>;
const adapters = { move: adaptMoveCard, lender: adaptLenderCard, insurance: adaptInsuranceCard, contractor: adaptContractorCard, senior: adaptSeniorCard, investor: adaptInvestorCard };
const contracts = Object.fromEntries(SPECIALIST_OWNED_HUBS.map((hub) => [hub, { hub, origin: 'FALLBACK', raw: raws[hub], presentation: adapters[hub](raws[hub], 'FALLBACK') }])) as Record<SpecialistHubId, LoadedSpecialistContract>;
const nextConfig = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8');
const seoSchemas = readFileSync(join(process.cwd(), 'lib', 'seo', 'schemas.ts'), 'utf8');

test('six accepted specialist fallbacks and fingerprints are current', () => {
  assert.equal(SPECIALIST_OWNED_HUBS.length, 6);
  for (const hub of SPECIALIST_OWNED_HUBS) assert.equal(raws[hub].sourceFingerprint, ACCEPTED_SPECIALIST_FINGERPRINTS[hub]);
});

test('network inventory is publication gated and retains source-native grains', () => {
  const inventory = buildAskNetworkEvidenceInventory(contracts);
  assert.equal(inventory.length, 119);
  assert.deepEqual(Object.fromEntries(SPECIALIST_OWNED_HUBS.map((hub) => [hub, inventory.filter((metric) => metric.hub === hub).length])), {
    move: 28, lender: 20, insurance: 27, contractor: 13, senior: 16, investor: 15,
  });
  assert.equal(inventory.some((metric) => ['INTERNAL', 'REJECTED', 'UNSUPPORTED'].includes(metric.publicationStatus)), false);
  assert.equal(inventory.every((metric) => metric.hub && metric.grain && metric.specialistFingerprint && metric.origin), true);
  assert.equal(new Set(inventory.map((metric) => metric.hub)).size, 6);
  assert.equal(Object.keys(NETWORK_EVIDENCE_FAMILY_LABELS).length, 12);
  assert.ok(inventory.some((metric) => metric.publicationStatus === 'PUBLIC_RESEARCH_GRAPH'));
  assert.equal(inventory.some((metric) => metric.key === 'disclosure_events'), false);
});

test('seven-state model preserves asymmetric specialist coverage', () => {
  const states = buildAskStateCoverage(contracts);
  assert.deepEqual(states.map((state) => state.askHref), ['/florida', '/new-jersey', '/california', '/texas', '/washington', '/arizona', '/colorado', '/virginia', '/new-york']);
  const az = states.find((state) => state.code === 'AZ')!;
  assert.equal(az.hubs.find((hub) => hub.hub === 'move')?.mode, 'NO_COMPARABLE_STATE_UNIVERSE');
  assert.equal(az.hubs.find((hub) => hub.hub === 'insurance')?.mode, 'NATIONAL_ONLY');
  const fl = states.find((state) => state.code === 'FL')!;
  assert.equal(fl.hubs.find((hub) => hub.hub === 'investor')?.mode, 'NATIONAL_ONLY');
  assert.equal(states.find((state) => state.code === 'WA')?.hubs.find((hub) => hub.hub === 'move')?.mode, 'SPECIALIST_PUBLISHED');
  assert.equal(states.find((state) => state.code === 'CO')?.hubs.every((hub) => hub.mode === 'SPECIALIST_PUBLISHED'), true);
  assert.equal(states.find((state) => state.code === 'VA')?.hubs.every((hub) => hub.mode === 'SPECIALIST_PUBLISHED'), true);
  assert.match(nextConfig, /source: '\/florida', destination: '\/places\/florida'/);
  for (const state of states) {
    const accepted = coverageArtifact.jurisdictions[`US-${state.code}` as keyof typeof coverageArtifact.jurisdictions];
    assert.equal(state.askHref, accepted.askPath);
    assert.deepEqual(state.hubs.filter((hub) => hub.mode === 'SPECIALIST_PUBLISHED').map((hub) => hub.hub).sort(), [...accepted.specialistPublished].sort());
    assert.deepEqual(state.hubs.filter((hub) => hub.mode === 'NATIONAL_ONLY').map((hub) => hub.hub).sort(), [...accepted.nationalOnly].sort());
    assert.deepEqual(state.hubs.filter((hub) => hub.mode === 'NO_COMPARABLE_STATE_UNIVERSE').map((hub) => hub.hub).sort(), [...('noComparableStateUniverse' in accepted ? accepted.noComparableStateUniverse : [])].sort());
  }
});

test('Move five-state and missing-universe semantics remain intact', () => {
  const paths = (move.network as { publishedStateIntelligencePaths: string[] }).publishedStateIntelligencePaths;
  assert.deepEqual(paths, ['/florida', '/new-jersey', '/california', '/texas', '/washington', '/colorado', '/virginia']);
  const metrics = move.metrics as Array<{ key: string; value: number | null; grain: string }>;
  assert.equal(metrics.find((metric) => metric.key === 'tx_txdmv_household_goods_mover_universe')?.value, null);
  assert.equal(metrics.find((metric) => metric.key === 'wa_utc_active_household_goods_directory_results')?.value, 284);
});

test('homepage removes stale geography and preserves semantic firewalls', () => {
  const home = readFileSync(join(process.cwd(), 'components/network-intelligence-home.tsx'), 'utf8');
  assert.doesNotMatch(home, /Florida is the current proof market/);
  assert.match(home, /No fake grand total/);
  assert.match(home, /complaint ≠ violation/);
  assert.match(home, /claiming permits corrections/i);
  assert.doesNotMatch(home, /AggregateRating|Trust Score|best provider|safest|vetted/i);
  assert.match(seoSchemas, /'@type': 'WebPage'/);
  assert.doesNotMatch(seoSchemas, /AggregateRating/);
});
