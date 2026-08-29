import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTrustHubNetworkState } from './aggregator.ts';
import { NETWORK_FINDINGS } from './findings.ts';
import { validateManifest } from './manifest.ts';
import { NAME_IS_NOT_IDENTITY } from './vocabulary.ts';
import { STANDARD_PIPELINE } from '../standard.ts';
import { IDENTIFIER_FAMILIES } from './identifiers.ts';
import { COVERAGE_ATLAS_VERSION } from './coverage-atlas.ts';
import { EVIDENCE_ATLAS_VERSION } from './evidence-atlas.ts';
import { FEDERATED_ASK_CONTRACT } from './federated-ask.ts';
import { CROSS_HUB_NAME_CHECK } from './name-check.ts';

test('six hubs, unique ids, grains, no mega-count', () => {
  const state = getTrustHubNetworkState();
  assert.equal(state.hubs.length, 6);
  assert.equal(new Set(state.hubs.map((h) => h.hub.id)).size, 6);
  for (const hub of state.hubs) {
    assert.equal(validateManifest(hub).filter((w) => w.code === 'dup_metric').length, 0);
    for (const metric of hub.metrics) {
      if (typeof metric.value === 'number') {
        assert.ok(metric.grain);
        assert.ok(metric.sourceFamily || metric.officialAsOf);
      }
    }
  }
  const blob = JSON.stringify(state);
  assert.doesNotMatch(blob, /24 million|2\.1 million/i);
  assert.doesNotMatch(blob, /Trust Score/i);
});

test('senior classes are not summed', () => {
  const senior = getTrustHubNetworkState().hubs.find((h) => h.hub.id === 'senior');
  assert.ok(senior);
  assert.match(String(senior.metrics[0].value), /Nursing homes/i);
  assert.doesNotMatch(JSON.stringify(senior), /senior providers total/i);
});

test('standard has EXPLAIN and no SCORE', () => {
  assert.ok(STANDARD_PIPELINE.some((s) => s.verb === 'EXPLAIN'));
  assert.ok(!STANDARD_PIPELINE.some((s) => s.verb === 'SCORE'));
  assert.equal(STANDARD_PIPELINE.map((s) => s.verb).join(' → '), 'SOURCE → VERIFY → EXPLAIN → DISCLOSE → UPDATE → YOU DECIDE');
});

test('exactly three findings', () => {
  assert.equal(NETWORK_FINDINGS.length, 3);
});

test('name is not identity', () => {
  assert.match(NAME_IS_NOT_IDENTITY, /display name/i);
});

test('identifier map does not claim unsupported live lookups', () => {
  const live = IDENTIFIER_FAMILIES.filter((f) => f.live).map((f) => f.id);
  assert.ok(live.includes('usdot'));
  assert.ok(!live.includes('cms_ccn'));
});

test('future schemas exist without claiming products complete', () => {
  assert.equal(COVERAGE_ATLAS_VERSION, 'coverage-atlas-schema-v1');
  assert.equal(EVIDENCE_ATLAS_VERSION, 'evidence-atlas-schema-v1');
  assert.equal(FEDERATED_ASK_CONTRACT, 'network-ask-route-v1');
  assert.equal(CROSS_HUB_NAME_CHECK.version, 'name-check-invariant-v1');
});

test('source counts are computed and not a mega-sum', () => {
  const state = getTrustHubNetworkState();
  assert.ok(state.sourceFamilyCount >= 6);
  assert.ok(state.sourceOrganizationCount >= 6);
  assert.ok(state.regulatorCount >= 1);
  assert.notEqual(state.sourceFamilyCount, 35);
  assert.notEqual(state.sourceOrganizationCount, 20);
  assert.equal('entityTotal' in state, false);
  assert.equal('networkTotal' in state, false);
  assert.equal('trustScore' in state, false);
});

test('official as-of and retrieved are separate clocks', () => {
  const state = getTrustHubNetworkState();
  for (const hub of state.hubs) {
    assert.ok(hub.snapshot.retrievedAt);
    assert.ok(hub.snapshot.officialAsOf || hub.metrics.some((m) => m.officialAsOf));
    assert.notEqual(hub.snapshot.officialAsOf, undefined);
  }
  assert.ok(state.latestOfficialAsOf);
  assert.ok(state.latestRetrievedAt);
});
