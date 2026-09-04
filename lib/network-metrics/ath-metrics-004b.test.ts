import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import moveFallback from '../../data/network-metrics/move-v1-fallback.json' with { type: 'json' };
import lenderFallback from '../../data/network-metrics/lender-v1-fallback.json' with { type: 'json' };
import insuranceFallback from '../../data/network-metrics/insurance-v1-fallback.json' with { type: 'json' };
import seniorFallback from '../../data/network-metrics/senior-v1-fallback.json' with { type: 'json' };
import { ACCEPTED_SPECIALIST_FINGERPRINTS, SPECIALIST_OWNED_HUBS, SPECIALIST_SOURCES } from './sources.ts';
import { adaptInsuranceCard, adaptLenderCard, adaptMoveCard, adaptSeniorCard } from './adapt.ts';
import { loadSpecialistCard } from './load.ts';
import { specialistCardMarkup } from './present.ts';
import {
  validateInsuranceManifest,
  validateLenderManifest,
  validateMoveManifest,
} from './validate.ts';

const home = readFileSync(join(process.cwd(), 'components/network-intelligence-home.tsx'), 'utf8');
const cardSource = readFileSync(join(process.cwd(), 'components/specialist-network-card.tsx'), 'utf8');
const metricValue = readFileSync(join(process.cwd(), 'components/metric-value.tsx'), 'utf8');
const FORBIDDEN = [
  '5022', '5,022', '4715', '4,715', '1099', '1,099',
  '14623', '14,623', '11529787', '11,529,787', '6793253', '6,793,253', '458146', '458,146',
  '82071', '82,071', '6185', '6,185', '1029860', '1,029,860', '1300108', '1,300,108',
  '622019', '622,019', '305156', '305,156',
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test('move, lender, and insurance schemas validate against accepted fingerprints', () => {
  const move = validateMoveManifest(moveFallback);
  const lender = validateLenderManifest(lenderFallback);
  const insurance = validateInsuranceManifest(insuranceFallback);
  assert.equal(move.sourceFingerprint, ACCEPTED_SPECIALIST_FINGERPRINTS.move);
  assert.equal(lender.sourceFingerprint, ACCEPTED_SPECIALIST_FINGERPRINTS.lender);
  assert.equal(insurance.sourceFingerprint, ACCEPTED_SPECIALIST_FINGERPRINTS.insurance);
  assert.equal(SPECIALIST_SOURCES.move.schemaVersion, 'move-network-metrics-v1');
  assert.equal(SPECIALIST_SOURCES.lender.schemaVersion, 'lender-network-metrics-v1');
  assert.equal(SPECIALIST_SOURCES.insurance.schemaVersion, 'insurance-network-metrics-v1');
  assert.deepEqual(SPECIALIST_OWNED_HUBS, ['move', 'lender', 'insurance', 'contractor', 'senior', 'investor']);
});

test('move adapter keeps federal directory distinct from Florida FDACS and does not zero missing universes', () => {
  const card = adaptMoveCard(moveFallback as Record<string, unknown>, 'UPSTREAM');
  assert.equal(card.primary[0]?.value, 5022);
  assert.equal(card.primary[0]?.grain, 'directory_profile');
  assert.equal(card.primary[0]?.label, 'Published moving companies');
  assert.equal(card.primary[1]?.value, 4715);
  assert.equal(card.primary[1]?.grain, 'directory_profile_authority_active');
  assert.equal(card.primary[2]?.value, 1099);
  assert.equal(card.primary[2]?.grain, 'fdacs_intrastate_mover_registration_active');
  assert.notEqual(card.primary[0]?.value, card.primary[2]?.value);
  assert.equal(card.primary.some((metric) => metric.value === 6121), false);
  assert.equal(card.secondary.find((metric) => metric.key === 'nj_operation_safe_move_novs_acquired')?.value, 34);
  assert.equal(card.secondary.find((metric) => metric.key === 'ca_bhgs_19237_citation_rows')?.value, 132);
  assert.equal(card.primary.some((metric) => metric.value === 0), false);
  assert.match(card.caveats.join(' '), /REQUEST_ONLY/);
  assert.match(card.caveats.join(' '), /NOT_ACQUIRED/);
  assert.match(card.newestSourceAsOfNote, /Not the as-of date of every federal profile/i);
});

test('lender adapter keeps applications, originations, and institutions distinct', () => {
  const card = adaptLenderCard(lenderFallback as Record<string, unknown>, 'UPSTREAM');
  assert.equal(card.primary[0]?.value, 14623);
  assert.equal(card.primary[0]?.grain, 'canonical_institution_entity');
  assert.equal(card.primary[0]?.label, 'Lenders & lending institutions');
  assert.equal(card.primary[1]?.value, 11529787);
  assert.equal(card.primary[1]?.grain, 'hmda_2025_county_observation');
  assert.equal(card.primary[2]?.value, 6793253);
  assert.equal(card.primary[3]?.value, 458146);
  assert.notEqual(card.primary[1]?.value, card.primary[2]?.value);
  assert.equal(card.primary.some((metric) => metric.value === 136763), false);
  assert.equal(card.primary.some((metric) => metric.value === 6682), false);
  assert.equal(card.primary.some((metric) => metric.value === 311), false);
  assert.equal(card.secondary.find((metric) => metric.key === 'federal_enforcement_events')?.value, 17655);
  assert.match(card.caveats.join(' '), /complaint observation is not a finding of wrongdoing/i);
});

test('insurance adapter keeps agency, producer, insurer, appointment, and CMS grains separate', () => {
  const card = adaptInsuranceCard(insuranceFallback as Record<string, unknown>, 'UPSTREAM');
  assert.equal(card.primary[0]?.value, 82071);
  assert.equal(card.primary[0]?.label, 'Insurance agencies');
  assert.equal(card.primary[1]?.value, 6185);
  assert.equal(card.primary[1]?.label, 'Licensed insurance companies');
  assert.equal(card.primary[2]?.value, 1029860);
  assert.equal(card.primary[3]?.value, 1300108);
  assert.equal(card.primary[3]?.grain, 'cms_marketplace_observation');
  assert.equal(card.secondary.find((metric) => metric.key === 'appointments')?.value, 622019);
  assert.notEqual(card.primary[0]?.value, card.secondary.find((metric) => metric.key === 'appointments')?.value);
  assert.equal(card.primary.some((metric) => metric.value === 1131663), false);
  assert.equal(card.primary.some((metric) => metric.value === 0), false);
  assert.doesNotMatch(card.primary.map((metric) => metric.label).join(' '), /\bcanonical\b/);
  assert.match(card.caveats.join(' '), /NOT_ACQUIRED/);
});

test('Move/Lender/Insurance upstream fixture changes propagate without homepage constant edits', async () => {
  const moveChanged = clone(moveFallback) as Record<string, unknown>;
  const lenderChanged = clone(lenderFallback) as Record<string, unknown>;
  const insuranceChanged = clone(insuranceFallback) as Record<string, unknown>;
  (moveChanged.metrics as Array<{ key: string; value: number }>).find((metric) => metric.key === 'federal_publishable_directory_profiles')!.value = 6002;
  (lenderChanged.metrics as Array<{ key: string; value: number }>).find((metric) => metric.key === 'hmda_2025_county_applications')!.value = 12000001;
  (insuranceChanged.metrics as Array<{ key: string; value: number }>).find((metric) => metric.key === 'cms_marketplace_evidence_observations')!.value = 1400001;
  const moveCard = await loadSpecialistCard('move', { fetchImpl: async () => jsonResponse(moveChanged) });
  const lenderCard = await loadSpecialistCard('lender', { fetchImpl: async () => jsonResponse(lenderChanged) });
  const insuranceCard = await loadSpecialistCard('insurance', { fetchImpl: async () => jsonResponse(insuranceChanged) });
  assert.equal(moveCard.origin, 'UPSTREAM');
  assert.equal(lenderCard.origin, 'UPSTREAM');
  assert.equal(insuranceCard.origin, 'UPSTREAM');
  assert.match(specialistCardMarkup(moveCard), /6,002/);
  assert.match(specialistCardMarkup(lenderCard), /12,000,001/);
  assert.match(specialistCardMarkup(insuranceCard), /1,400,001/);
  assert.doesNotMatch(home, /6002|12000001|1400001/);
  assert.doesNotMatch(cardSource, /6002|12000001|1400001/);
});

test('Move/Lender/Insurance timeout, 500, invalid JSON, wrong schema, missing metric, and negative value use fallback not zero', async () => {
  const cases: Array<() => Promise<Response>> = [
    async () => { throw new Error('timeout'); },
    async () => jsonResponse({ error: 'nope' }, 500),
    async () => new Response('not-json', { status: 200 }),
    async () => jsonResponse({ ...clone(moveFallback), schemaVersion: 'move-network-metrics-v0' }),
    async () => {
      const raw = clone(moveFallback) as Record<string, unknown>;
      raw.metrics = (raw.metrics as unknown[]).filter((item) => (item as { key: string }).key !== 'federal_publishable_directory_profiles');
      return jsonResponse(raw);
    },
    async () => {
      const raw = clone(moveFallback) as Record<string, unknown>;
      (raw.metrics as Array<{ key: string; value: number }>).find((metric) => metric.key === 'federal_publishable_directory_profiles')!.value = -1;
      return jsonResponse(raw);
    },
  ];
  for (const fetchImpl of cases) {
    const card = await loadSpecialistCard('move', { fetchImpl });
    assert.equal(card.origin, 'FALLBACK');
    assert.equal(card.primary[0]?.value, 5022);
    assert.notEqual(card.primary[0]?.value, 0);
    const html = specialistCardMarkup(card);
    assert.match(html, /last-known-good specialist snapshot/i);
    assert.match(html, /5,022 Published moving companies/);
  }
  for (const hub of ['lender', 'insurance'] as const) {
    const card = await loadSpecialistCard(hub, { fetchImpl: async () => { throw new Error('timeout'); } });
    assert.equal(card.origin, 'FALLBACK');
    assert.ok((card.primary[0]?.value ?? 0) > 0);
  }
});

test('presentation files do not hardcode Move/Lender/Insurance production counts and keep MetricValue', () => {
  for (const source of [home, cardSource]) {
    for (const literal of FORBIDDEN) {
      assert.doesNotMatch(source, new RegExp(literal.replaceAll(',', '\\,')));
    }
  }
  assert.match(cardSource, /MetricValue/);
  assert.match(metricValue, /fontSize: metricFontSize/);
  assert.match(home, /SPECIALIST_OWNED_HUBS|SPECIALIST_CARD_HUBS/);
  assert.doesNotMatch(home, /useEffect|fetch\(/);
});

test('Contractor and Senior selections do not regress', () => {
  const senior = adaptSeniorCard(seniorFallback as Record<string, unknown>, 'UPSTREAM');
  assert.deepEqual(senior.universes.map((metric) => metric.value), [14690, 12460, 6669]);
  assert.equal(senior.primary.find((metric) => metric.key === 'mds_observations')?.value, 1248650);
  assert.equal(senior.primary.find((metric) => metric.key === 'health_deficiencies')?.value, 419479);
  assert.equal(senior.primary.find((metric) => metric.key === 'fire_citations')?.value, 200327);
  assert.equal(senior.primary.find((metric) => metric.key === 'inspection_events')?.value, 149978);
  assert.equal(senior.primary.find((metric) => metric.key === 'enforcement_records')?.value, 15694);
  assert.equal(senior.primary.some((metric) => metric.value === 33819), false);
  const contractor = JSON.parse(readFileSync(join(process.cwd(), 'data/network-metrics/contractor-v1-fallback.json'), 'utf8'));
  const live = (contractor.metrics as Array<{ key: string; value: number }>).find((metric) => metric.key === 'live_credential_records');
  assert.equal(live?.value, 644421);
});

test('missing Move/Lender/Insurance universes fail closed instead of becoming zero', () => {
  const move = clone(moveFallback) as Record<string, unknown>;
  (move.metrics as Array<{ key: string; value: number | null; valueState: string }>).find((metric) => metric.key === 'nj_pmw_authority_roster')!.value = 0;
  assert.throws(() => validateMoveManifest(move), /must not be a number/);
  const insurance = clone(insuranceFallback) as Record<string, unknown>;
  (insurance.metrics as Array<{ key: string; value: number | null; valueState: string }>).find((metric) => metric.key === 'texas_authorized_companies')!.value = 0;
  assert.throws(() => validateInsuranceManifest(insurance), /must not be a number/);
});
