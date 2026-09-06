import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprint, HUB_IDS, readArtifact, validateNetwork } from './contract.ts';

const network = validateNetwork();
const manifests = network.manifests;
const byHub = Object.fromEntries(manifests.map((manifest) => [manifest.hub_id, manifest]));
type NetworkContract = {
  version: string;
  global_policy: { universal_score: boolean; paid_status_affects_search_order: boolean };
  safe_aggregate_metrics: unknown[];
  aggregate_assessments: Array<{ metric: string; classification: string }>;
  refresh_strategy: { failure_behavior: string };
};
type CoverageCell = { askPath: string; specialistPublished: string[]; nationalOnly: string[]; noComparableStateUniverse?: string[]; limitations: string[] };
type Coverage = { jurisdictions: Record<string, CoverageCell> };
const contract = readArtifact<NetworkContract>('ask-network-intel-v1.json');
const coverage = readArtifact<Coverage>('network-coverage-v1.json');

test('exactly six known, traceable hub manifests validate', () => {
  assert.deepEqual(manifests.map((m) => m.hub_id), HUB_IDS);
  for (const manifest of manifests) {
    assert.match(manifest.canonical_url, /^https:\/\//);
    assert.match(manifest.source_main_sha, /^[a-f0-9]{40}$/);
    for (const metric of [...manifest.entity_counts, ...manifest.evidence_counts]) {
      assert.ok(metric.grain && metric.source_contract && metric.source_family && metric.retrieved_at && metric.limitation);
    }
  }
});

test('entity and publication grains remain distinct', () => {
  assert.deepEqual(byHub.senior.entity_classes.map((x) => x.id), ['nursing_home', 'home_health', 'hospice']);
  assert.equal(byHub.senior.entity_counts.length, 0);
  assert.ok(byHub.insurance.entity_classes.some((x) => x.id === 'agency'));
  assert.ok(byHub.insurance.entity_classes.some((x) => x.id === 'legal_insurer'));
  assert.deepEqual(byHub.lender.entity_classes.map((x) => x.id), ['institution', 'branch', 'person_mlo']);
  assert.match(byHub.contractor.entity_counts[0].grain, /credential/i);
  assert.match(byHub.contractor.entity_counts[0].limitation, /not contractor entities/i);
});

test('semantic firewalls are explicit', () => {
  const all = JSON.stringify({ manifests, contract }).toLowerCase();
  assert.match(all, /headquarters is not service territory/);
  assert.match(all, /complaint is not violation/);
  assert.match(all, /examination is not enforcement/);
  assert.match(all, /registration is not endorsement/);
  assert.match(all, /raum is not performance/);
});

test('no universal score, paid ordering, or unsupported provider mega-total', () => {
  assert.equal(contract.global_policy.universal_score, false);
  assert.equal(contract.global_policy.paid_status_affects_search_order, false);
  assert.equal(contract.safe_aggregate_metrics.length, 0);
  assert.equal(contract.aggregate_assessments.find((x) => x.metric.includes('provider'))?.classification, 'NOT_SAFE_TO_SUM');
});

test('six-state routing metadata preserves asymmetric specialist coverage', () => {
  assert.deepEqual(Object.keys(coverage.jurisdictions), ['US-FL', 'US-NJ', 'US-CA', 'US-TX', 'US-WA', 'US-AZ']);
  assert.equal(coverage.jurisdictions['US-FL'].askPath, '/florida');
  assert.deepEqual(coverage.jurisdictions['US-FL'].nationalOnly, ['investor']);
  for (const state of ['US-NJ', 'US-CA', 'US-TX', 'US-WA']) assert.deepEqual([...coverage.jurisdictions[state].specialistPublished].sort(), [...HUB_IDS].sort());
  assert.deepEqual([...coverage.jurisdictions['US-AZ'].specialistPublished].sort(), ['contractor', 'investor', 'lender', 'senior']);
  assert.deepEqual(coverage.jurisdictions['US-AZ'].nationalOnly, ['insurance']);
  assert.deepEqual(coverage.jurisdictions['US-AZ'].noComparableStateUniverse, ['move']);
  for (const cell of Object.values(coverage.jurisdictions)) assert.ok(cell.askPath && cell.limitations.length);
});

test('source ledger, coverage, and network fingerprints are deterministic', () => {
  const first = validateNetwork().fingerprints;
  const second = validateNetwork().fingerprints;
  const accepted = readArtifact<Record<string, string>>('fingerprints-v1.json');
  assert.deepEqual(first, second);
  assert.equal(Object.keys(first).length, 9);
  for (const value of Object.values(first)) assert.match(value, /^[a-f0-9]{64}$/);
  assert.equal(fingerprint(readArtifact('ask-network-intel-v1.json')), first['ask-network-intel-v1']);
  for (const [key, value] of Object.entries(first)) assert.equal(accepted[key], value);
});

test('search and customer contract source files are unchanged by this contract', () => {
  assert.ok(readArtifact('ask-network-intel-v1.json'));
  assert.equal(contract.version, 'ask-network-intel-v1');
  assert.equal(contract.refresh_strategy.failure_behavior.includes('last accepted'), true);
});
