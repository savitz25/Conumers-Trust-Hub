import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import contractorFallback from '../../data/network-metrics/contractor-v1-fallback.json' with { type: 'json' };
import seniorFallback from '../../data/network-metrics/senior-v1-fallback.json' with { type: 'json' };
import { loadHubManifests, readArtifact } from '../network-intelligence/contract.ts';
import { ACCEPTED_SPECIALIST_FINGERPRINTS, SPECIALIST_SOURCES } from './sources.ts';
import { adaptContractorCard, adaptSeniorCard } from './adapt.ts';
import {
  CONSUMER_METRIC_LABELS,
  HOMEPAGE_PUBLIC_METRIC_IDS,
  consumerMetricLabel,
  isInternalPublicNoun,
} from './consumer-labels.ts';
import { loadSpecialistCard } from './load.ts';
import { specialistCardMarkup } from './present.ts';
import { validateContractorManifest, validateSeniorManifest } from './validate.ts';

const home = readFileSync(join(process.cwd(), 'components/network-intelligence-home.tsx'), 'utf8');
const cardSource = readFileSync(join(process.cwd(), 'components/specialist-network-card.tsx'), 'utf8');
const loadSource = readFileSync(join(process.cwd(), 'lib/network-metrics/load.ts'), 'utf8');
const FORBIDDEN_LITERALS = [
  '644421', '499997', '14690', '12460', '6669', '1248650', '2678341',
  '644,421', '14,690', '1,248,650', '2,678,341',
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test('contractor and senior schemas validate and match accepted fingerprints', () => {
  const contractor = validateContractorManifest(contractorFallback);
  const senior = validateSeniorManifest(seniorFallback);
  assert.equal(contractor.sourceFingerprint, ACCEPTED_SPECIALIST_FINGERPRINTS.contractor);
  assert.equal(senior.sourceFingerprint, ACCEPTED_SPECIALIST_FINGERPRINTS.senior);
  assert.equal(SPECIALIST_SOURCES.contractor.schemaVersion, 'contractor-network-metrics-v1');
  assert.equal(SPECIALIST_SOURCES.senior.schemaVersion, 'senior-network-metrics-v1');
});

test('contractor adapter keeps credentials distinct from NJ construction source records', () => {
  const card = adaptContractorCard(contractorFallback as Record<string, unknown>, 'UPSTREAM');
  const live = card.primary.find((metric) => metric.key === 'live_credential_records');
  const nj = card.primary.find((metric) => metric.key === 'nj_construction_source_records');
  const ca = card.caveats.join(' ');
  assert.equal(live?.value, 644421);
  assert.equal(live?.grain, 'license_credential_record');
  assert.equal(live?.label, 'Contractor license records');
  assert.doesNotMatch(live?.label ?? '', /contracting companies/i);
  assert.equal(nj?.value, 2678341);
  assert.equal(nj?.grain, 'municipal_permit_or_certificate_source_record');
  assert.notEqual(live?.value, nj?.value);
  assert.match(ca, /not live California credentials/i);
  assert.doesNotMatch(ca, /75,572 California credentials/);
  assert.equal(card.newestSourceAsOf, '2026-09-02');
  assert.match(card.newestSourceAsOfNote, /Not the live-credential board extract date/i);
});

test('senior adapter keeps three universes separate and rejects combined headlines', () => {
  const card = adaptSeniorCard(seniorFallback as Record<string, unknown>, 'UPSTREAM');
  assert.deepEqual(card.universes.map((metric) => [metric.key, metric.value, metric.label]), [
    ['current_nursing_homes', 14690, 'Current nursing homes'],
    ['current_home_health_agencies', 12460, 'Current home health agencies'],
    ['current_hospice_providers', 6669, 'Current hospice providers'],
  ]);
  assert.equal(card.primary.find((metric) => metric.key === 'mds_observations')?.value, 1248650);
  assert.equal(card.primary.find((metric) => metric.key === 'inspection_events')?.value, 149978);
  assert.equal(card.universes.reduce((sum, metric) => sum + metric.value, 0), 33819);
  assert.equal(card.primary.some((metric) => metric.value === 33819), false);
  assert.equal(card.primary.some((metric) => metric.value === 2053842), false);
  assert.match(card.newestSourceAsOfNote, /Not a single network clock/i);
  assert.equal(card.universes.find((metric) => metric.key === 'current_nursing_homes')?.sourceAsOf, '2026-08-01');
  assert.equal(card.universes.find((metric) => metric.key === 'current_home_health_agencies')?.sourceAsOf, '2026-05-27');
  assert.equal(card.universes.find((metric) => metric.key === 'current_hospice_providers')?.sourceAsOf, '2026-08-19');
});

test('upstream fixture change propagates without homepage constant edits', async () => {
  const contractorChanged = clone(contractorFallback) as Record<string, unknown>;
  const seniorChanged = clone(seniorFallback) as Record<string, unknown>;
  (contractorChanged.metrics as Array<{ key: string; value: number }>).find((metric) => metric.key === 'live_credential_records')!.value = 700001;
  (seniorChanged.metrics as Array<{ key: string; value: number }>).find((metric) => metric.key === 'mds_observations')!.value = 1300001;
  const contractorCard = await loadSpecialistCard('contractor', {
    fetchImpl: async () => jsonResponse(contractorChanged),
  });
  const seniorCard = await loadSpecialistCard('senior', {
    fetchImpl: async () => jsonResponse(seniorChanged),
  });
  assert.equal(contractorCard.origin, 'UPSTREAM');
  assert.equal(seniorCard.origin, 'UPSTREAM');
  const contractorHtml = specialistCardMarkup(contractorCard);
  const seniorHtml = specialistCardMarkup(seniorCard);
  assert.match(contractorHtml, /700,001/);
  assert.match(seniorHtml, /1,300,001/);
  assert.doesNotMatch(home, /700001|1300001/);
  assert.doesNotMatch(cardSource, /700001|1300001/);
});

test('timeout, 500, invalid JSON, wrong schema, missing metric, and negative value use fallback not zero', async () => {
  const cases: Array<() => Promise<Response>> = [
    async () => { throw new Error('timeout'); },
    async () => jsonResponse({ error: 'nope' }, 500),
    async () => new Response('not-json', { status: 200 }),
    async () => jsonResponse({ ...clone(contractorFallback), schemaVersion: 'contractor-network-metrics-v0' }),
    async () => {
      const raw = clone(contractorFallback) as Record<string, unknown>;
      raw.metrics = (raw.metrics as unknown[]).filter((item) => (item as { key: string }).key !== 'live_credential_records');
      return jsonResponse(raw);
    },
    async () => {
      const raw = clone(contractorFallback) as Record<string, unknown>;
      (raw.metrics as Array<{ key: string; value: number }>).find((metric) => metric.key === 'live_credential_records')!.value = -1;
      return jsonResponse(raw);
    },
  ];
  for (const fetchImpl of cases) {
    const card = await loadSpecialistCard('contractor', { fetchImpl });
    assert.equal(card.origin, 'FALLBACK');
    const live = card.primary.find((metric) => metric.key === 'live_credential_records');
    assert.equal(live?.value, 644421);
    assert.notEqual(live?.value, 0);
    const html = specialistCardMarkup(card);
    assert.match(html, /last-known-good specialist snapshot/i);
    assert.doesNotMatch(html, /^0 /m);
    assert.match(html, /644,421 Contractor license records/);
  }
});

test('presentation files do not hardcode production counts', () => {
  for (const source of [home, cardSource, loadSource]) {
    for (const literal of FORBIDDEN_LITERALS) {
      assert.doesNotMatch(source, new RegExp(literal.replaceAll(',', '\\,')));
    }
    assert.doesNotMatch(source, /Last official update:\s*Aug 28, 2026/i);
    assert.doesNotMatch(source, /33,819|1\.6M\+|2,053,842/);
  }
  assert.doesNotMatch(loadSource, /readFileSync/);
});

test('homepage consumes specialist cards and keeps other hubs on local manifests', () => {
  assert.match(home, /SpecialistNetworkCard/);
  assert.match(home, /loadSpecialistNetworkCards/);
  assert.match(home, /HubCard/);
  assert.match(home, /consumerMetricLabel/);
  assert.doesNotMatch(home, /useEffect|fetch\(/);
});

test('trace and freshness preserve specialist clocks', () => {
  const contractor = adaptContractorCard(contractorFallback as Record<string, unknown>, 'UPSTREAM');
  const senior = adaptSeniorCard(seniorFallback as Record<string, unknown>, 'UPSTREAM');
  const contractorHtml = specialistCardMarkup(contractor);
  const seniorHtml = specialistCardMarkup(senior);
  assert.match(contractorHtml, /Trace this number/);
  assert.match(contractorHtml, /Newest documented specialist source date/);
  assert.match(contractorHtml, /2026-09-02/);
  assert.match(seniorHtml, /2026-08-01/);
  assert.match(seniorHtml, /2026-05-27/);
  assert.match(seniorHtml, /2026-08-19/);
  assert.match(seniorHtml, /Not a single network clock/);
  assert.match(contractorHtml, /2,678,341/);
  assert.match(contractorHtml, /NJ construction source records/);
  assert.match(contractorHtml, /Grain license_credential_record/);
});

test('public State of the Network copy uses consumer entity labels without changing grain', () => {
  const manifests = loadHubManifests();
  const homeContract = readArtifact<{ displayed_metric_ids: Record<string, string[]> }>('ask-home-intel-v1.json');
  for (const id of HOMEPAGE_PUBLIC_METRIC_IDS) {
    const publicLabel = CONSUMER_METRIC_LABELS[id];
    assert.ok(publicLabel, `missing public label for ${id}`);
    assert.equal(isInternalPublicNoun(publicLabel), false, publicLabel);
  }
  const expected: Record<string, string> = {
    move_public_profiles: 'Published moving companies',
    move_authority_recorded: 'Moving companies with current authority',
    lender_institutions: 'Lenders & lending institutions',
    insurance_agencies: 'Insurance agencies',
    insurance_legal_insurers: 'Licensed insurance companies',
    investor_iard_roster: 'Investment advisory firms',
    investor_ria_firms: 'Registered investment adviser records',
    investor_era_firms: 'Exempt reporting adviser records',
  };
  for (const [id, label] of Object.entries(expected)) {
    assert.equal(consumerMetricLabel(id, 'fallback'), label);
  }
  for (const manifest of manifests) {
    if (manifest.hub_id === 'contractor' || manifest.hub_id === 'senior') continue;
    for (const id of homeContract.displayed_metric_ids[manifest.hub_id]) {
      const metric = [...manifest.entity_counts, ...manifest.evidence_counts].find((item) => item.metric_id === id);
      assert.ok(metric, `${manifest.hub_id}:${id}`);
      const publicLabel = consumerMetricLabel(id, metric.label);
      assert.equal(isInternalPublicNoun(publicLabel), false, `${id} public label ${publicLabel}`);
      assert.match(home, /metric\.label/);
      assert.match(home, /Source label/);
    }
  }
  const move = manifests.find((manifest) => manifest.hub_id === 'move');
  const lender = manifests.find((manifest) => manifest.hub_id === 'lender');
  const insurance = manifests.find((manifest) => manifest.hub_id === 'insurance');
  const investor = manifests.find((manifest) => manifest.hub_id === 'investor');
  assert.equal(move?.entity_counts[0].grain, 'published mover identity');
  assert.equal(move?.entity_counts[0].label, 'Published mover identities');
  assert.equal(lender?.entity_counts[0].grain, 'canonical institution entity');
  assert.equal(lender?.entity_counts[0].label, 'Canonical institutions');
  assert.equal(insurance?.entity_counts[0].label, 'Canonical agencies');
  assert.equal(investor?.entity_counts[0].label, 'SEC/IARD roster firms');
  assert.equal(investor?.entity_counts.find((metric) => metric.metric_id === 'investor_ria_firms')?.label, 'RIA facts');
  assert.equal(investor?.entity_counts.find((metric) => metric.metric_id === 'investor_era_firms')?.label, 'ERA facts');

  const contractor = adaptContractorCard(contractorFallback as Record<string, unknown>, 'UPSTREAM');
  const senior = adaptSeniorCard(seniorFallback as Record<string, unknown>, 'UPSTREAM');
  const contractorPublic = contractor.primary.map((metric) => metric.label).join(' ');
  assert.match(contractorPublic, /Contractor license records/);
  assert.match(contractorPublic, /Active\/current contractor licenses/);
  assert.doesNotMatch(contractorPublic, /contracting companies/i);
  assert.equal(isInternalPublicNoun(contractor.primary[0].label), false);
  assert.equal(contractor.primary[0].grain, 'license_credential_record');
  for (const metric of senior.universes) {
    assert.equal(isInternalPublicNoun(metric.label), false);
    assert.equal(metric.grain, 'current_directory_provider');
  }
  assert.match(home, /consumerMetricLabel\(metric\.metric_id, metric\.label\)/);
});
