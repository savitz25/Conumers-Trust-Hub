import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fingerprint, loadHubManifests, readArtifact, validateNetwork } from './contract.ts';

type HomeContract = {
  version: string; network_contract_fingerprint: string;
  displayed_metric_ids: Record<string, string[]>;
  derived_display_metrics: Array<{ metric_id: string; value: number; calculation: string }>;
  section_order: string[]; coverage_mode: string; runtime_data_strategy: string;
  what_changed_mode: string; forbidden_features: string[];
};
type CoverageCell = { level: string; evidenceFamilies: string[]; routes: string[] };
type Coverage = { jurisdictions: Record<string, Record<string, CoverageCell>> };

const source = readFileSync(join(process.cwd(), 'components', 'network-intelligence-home.tsx'), 'utf8');
const page = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf8');
const input = readFileSync(join(process.cwd(), 'components', 'network-ask-input.tsx'), 'utf8');
const home = readArtifact<HomeContract>('ask-home-intel-v1.json');
const acceptedHomeFingerprint = readArtifact<Record<string, string>>('homepage-fingerprint-v1.json');
const coverage = readArtifact<Coverage>('network-coverage-v1.json');
const manifests = loadHubManifests();

test('accepted network fingerprint remains the homepage input', () => {
  assert.equal(validateNetwork().fingerprints['ask-network-intel-v1'], '834dadcfa800e84914cb0e328f21234f42d7a7314c29d497f801dab2e8d202e1');
  assert.equal(home.network_contract_fingerprint, validateNetwork().fingerprints['ask-network-intel-v1']);
});

test('six cards use traceable metric IDs and preserve entity grains', () => {
  assert.equal(manifests.length, 6);
  for (const manifest of manifests) {
    const available = new Set([...manifest.entity_counts, ...manifest.evidence_counts].map((metric) => metric.metric_id));
    for (const id of home.displayed_metric_ids[manifest.hub_id]) assert.ok(available.has(id), `${manifest.hub_id}:${id}`);
  }
  assert.deepEqual(home.displayed_metric_ids.senior, []);
  assert.deepEqual(home.displayed_metric_ids.move, []);
  assert.deepEqual(home.displayed_metric_ids.lender, []);
  assert.deepEqual(home.displayed_metric_ids.insurance, []);
  assert.deepEqual(home.displayed_metric_ids.contractor, []);
  assert.deepEqual(manifests.find((manifest) => manifest.hub_id === 'senior')?.entity_classes.map((entity) => entity.label), ['Nursing home','Home health agency','Hospice provider']);
  assert.match(manifests.find((manifest) => manifest.hub_id === 'contractor')?.entity_counts[0].grain ?? '', /credential record/);
  assert.doesNotMatch(source, /644,421 contractors/);
  assert.match(source, /RAUM ≠ performance/);
});

test('no unsafe aggregate, stale source claim, or ambiguous Lender profile claim', () => {
  assert.doesNotMatch(source, /1\.8 million providers|2 million trusted|verified providers/i);
  assert.doesNotMatch(source, /14 public-source|13 source organizations/i);
  assert.doesNotMatch(source, /180 profiles/i);
  assert.equal(home.derived_display_metrics.find((metric) => metric.metric_id === 'normalized_publisher_count')?.value, 11);
  assert.equal(home.derived_display_metrics.find((metric) => metric.metric_id === 'normalized_dataset_entry_count')?.value, 11);
});

test('Florida levels are exact and future empty states stay undisplayed', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(coverage.jurisdictions['US-FL']).map(([id, cell]) => [id, cell.level])), { move:'STATE_ENHANCED', lender:'STATE_ENHANCED', insurance:'STATE_VERIFY', senior:'NATIONAL_SPINE', contractor:'STATE_ENHANCED', investor:'STATE_VERIFY' });
  for (const state of ['US-NJ','US-TX','US-NY','US-WA','US-CA','US-IL']) assert.deepEqual(coverage.jurisdictions[state], {});
  assert.match(source, /Empty future-state contract keys/);
});

test('consumer semantic firewalls and limitations are visible', () => {
  for (const phrase of ['examination ≠ enforcement','complaint ≠ violation','credential ≠ endorsement','HQ ≠ service territory','RAUM ≠ performance']) assert.ok(source.includes(phrase));
  assert.match(source, /Missing evidence is not a clean-record guarantee/);
  assert.doesNotMatch(source, /Trust Score/);
  assert.match(source, /No paid ranking or network recommendation/);
});

test('accepted Federated Ask is the hero and Concierge stays distinct', () => {
  assert.match(source, /<NetworkAskInput \/>/);
  assert.match(source, /Federated Ask queries structured public evidence/);
  assert.match(source, /<HomeConciergeDemoted \/>/);
  assert.equal((input.match(/\['[^']+', '[^']+'\]/g) ?? []).length, 5);
});

test('Trace, clocks, source ledger, methodology, and initial baseline are real', () => {
  assert.match(source, /Trace this number/);
  assert.match(source, /metric\.as_of_date/);
  assert.match(source, /metric\.retrieved_at/);
  assert.match(source, /Initial network baseline established/);
  assert.equal(home.what_changed_mode, 'initial_baseline');
  assert.doesNotMatch(source, /Market improved|Risk increased|Consumers are safer/);
  assert.doesNotMatch(JSON.stringify(home), /SCORE/);
});

test('one H1, factual metadata, and no ranking structured data', () => {
  assert.equal((source.match(/<h1\b/g) ?? []).length, 1);
  assert.match(page, /Public Regulatory Research/);
  assert.doesNotMatch(`${page}${source}`, /AggregateRating|ItemList|Review/);
});

test('snapshot rendering and homepage fingerprint are deterministic', () => {
  assert.equal(home.runtime_data_strategy, 'specialist_upstream_revalidate_3600_with_fallback');
  assert.equal(home.coverage_mode, 'contract_driven_matrix');
  assert.equal(fingerprint(home), acceptedHomeFingerprint['ask-home-intel-v1']);
  assert.equal(fingerprint(readArtifact<HomeContract>('ask-home-intel-v1.json')), acceptedHomeFingerprint['ask-home-intel-v1']);
  assert.ok(home.forbidden_features.includes('live_six_hub_fanout'));
});

test('customer status never participates in homepage ranking', () => {
  assert.doesNotMatch(source, /subscription|premium provider|verified business|claimed by/i);
  assert.match(source, /Paid or managed status does not change/);
});
