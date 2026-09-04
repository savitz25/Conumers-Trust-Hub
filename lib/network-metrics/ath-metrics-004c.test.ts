import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import investorFallback from '../../data/network-metrics/investor-v1-fallback.json' with { type: 'json' };
import { ACCEPTED_SPECIALIST_FINGERPRINTS, SPECIALIST_OWNED_HUBS, SPECIALIST_SOURCES } from './sources.ts';
import { adaptInvestorCard } from './adapt.ts';
import { loadSpecialistCard, loadSpecialistNetworkCards } from './load.ts';
import { specialistCardMarkup } from './present.ts';
import { validateInvestorManifest } from './validate.ts';

const home = readFileSync(join(process.cwd(), 'components/network-intelligence-home.tsx'), 'utf8');
const cardSource = readFileSync(join(process.cwd(), 'components/specialist-network-card.tsx'), 'utf8');
const FORBIDDEN = [
  '23622', '23,622', '17018', '17,018', '6604', '6,604',
  '5149596', '5,149,596', '635269', '635,269', '158560', '158,560',
  '25777', '25,777',
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test('investor schema validates against accepted fingerprint and RIA XOR ERA partition', () => {
  const investor = validateInvestorManifest(investorFallback);
  assert.equal(investor.sourceFingerprint, ACCEPTED_SPECIALIST_FINGERPRINTS.investor);
  assert.equal(SPECIALIST_SOURCES.investor.schemaVersion, 'investor-network-metrics-v1');
  assert.equal(SPECIALIST_OWNED_HUBS.includes('investor'), true);
  assert.equal(SPECIALIST_OWNED_HUBS.length, 6);
  const ria = (investorFallback.metrics as Array<{ key: string; value: number }>).find((metric) => metric.key === 'ria_records')!.value;
  const era = (investorFallback.metrics as Array<{ key: string; value: number }>).find((metric) => metric.key === 'era_records')!.value;
  const roster = (investorFallback.metrics as Array<{ key: string; value: number }>).find((metric) => metric.key === 'investment_advisory_firms')!.value;
  assert.equal(ria + era, roster);
  assert.equal(ria + era, 23622);
});

test('investor adapter uses consumer labels and Form ADV observations are not firms', () => {
  const card = adaptInvestorCard(investorFallback as Record<string, unknown>, 'UPSTREAM');
  assert.equal(card.primary[0]?.value, 23622);
  assert.equal(card.primary[0]?.grain, 'sec_iard_roster_firm');
  assert.equal(card.primary[0]?.label, 'Investment advisory firms');
  assert.equal(card.primary[1]?.value, 17018);
  assert.equal(card.primary[1]?.grain, 'ria_firm_fact');
  assert.equal(card.primary[1]?.label, 'Registered investment adviser records');
  assert.equal(card.primary[2]?.value, 6604);
  assert.equal(card.primary[2]?.grain, 'era_firm_fact');
  assert.equal(card.primary[2]?.label, 'Exempt reporting adviser records');
  assert.equal(card.secondary[0]?.value, 5149596);
  assert.equal(card.secondary[0]?.grain, 'form_adv_attribute_observation');
  assert.equal(card.secondary[0]?.label, 'Form ADV attribute observations');
  assert.equal(card.secondary.find((metric) => metric.key === 'form_adv_filings')?.value, 635269);
  assert.equal(card.secondary.find((metric) => metric.key === 'ownership_control_observations')?.value, 158560);
  assert.equal(card.secondary.find((metric) => metric.key === 'indexable_firm_profiles')?.value, 1000);
  assert.equal(card.primary.some((metric) => metric.value === 25777), false);
  assert.equal(card.primary.some((metric) => metric.value === 5149596), false);
  assert.doesNotMatch(card.primary.map((metric) => metric.label).join(' '), /\bcanonical\b|RIA facts|ERA facts/i);
  assert.match(card.caveats.join(' '), /ERA is not an RIA/);
  assert.match(card.caveats.join(' '), /not advisers, firms, filings/);
  assert.match(card.caveats.join(' '), /RAUM is not investment performance/);
  assert.match(card.newestSourceAsOfNote, /Not the SEC roster date|Not the as-of date of every filing/i);
});

test('Investor upstream fixture changes propagate without homepage constant edits', async () => {
  const changed = clone(investorFallback) as Record<string, unknown>;
  (changed.metrics as Array<{ key: string; value: number }>).find((metric) => metric.key === 'investment_advisory_firms')!.value = 24001;
  (changed.metrics as Array<{ key: string; value: number }>).find((metric) => metric.key === 'ria_records')!.value = 17400;
  (changed.metrics as Array<{ key: string; value: number }>).find((metric) => metric.key === 'era_records')!.value = 6601;
  (changed.metrics as Array<{ key: string; value: number }>).find((metric) => metric.key === 'form_adv_attribute_observations')!.value = 5250000;
  const card = await loadSpecialistCard('investor', { fetchImpl: async () => jsonResponse(changed) });
  assert.equal(card.origin, 'UPSTREAM');
  const html = specialistCardMarkup(card);
  assert.match(html, /24,001/);
  assert.match(html, /5,250,000/);
  assert.doesNotMatch(home, /24001|5250000/);
  assert.doesNotMatch(cardSource, /24001|5250000/);
});

test('Investor timeout, 500, invalid JSON, wrong schema, missing metric, negative, and broken partition use fallback', async () => {
  const cases: Array<() => Promise<Response>> = [
    async () => { throw new Error('timeout'); },
    async () => jsonResponse({ error: 'nope' }, 500),
    async () => new Response('not-json', { status: 200 }),
    async () => jsonResponse({ ...clone(investorFallback), schemaVersion: 'investor-network-metrics-v0' }),
    async () => {
      const raw = clone(investorFallback) as Record<string, unknown>;
      raw.metrics = (raw.metrics as unknown[]).filter((item) => (item as { key: string }).key !== 'investment_advisory_firms');
      return jsonResponse(raw);
    },
    async () => {
      const raw = clone(investorFallback) as Record<string, unknown>;
      (raw.metrics as Array<{ key: string; value: number }>).find((metric) => metric.key === 'investment_advisory_firms')!.value = -1;
      return jsonResponse(raw);
    },
    async () => {
      const raw = clone(investorFallback) as Record<string, unknown>;
      (raw.metrics as Array<{ key: string; value: number }>).find((metric) => metric.key === 'ria_records')!.value = 1;
      return jsonResponse(raw);
    },
  ];
  for (const fetchImpl of cases) {
    const card = await loadSpecialistCard('investor', { fetchImpl });
    assert.equal(card.origin, 'FALLBACK');
    assert.equal(card.primary[0]?.value, 23622);
    assert.notEqual(card.primary[0]?.value, 0);
    assert.match(specialistCardMarkup(card), /23,622 Investment advisory firms/);
  }
});

test('presentation files do not hardcode Investor production counts', () => {
  for (const source of [home, cardSource]) {
    for (const literal of FORBIDDEN) {
      assert.doesNotMatch(source, new RegExp(literal.replaceAll(',', '\\,')));
    }
  }
  assert.match(home, /specialist hub's published metric contract/);
  assert.doesNotMatch(home, /Investor remains on the accepted local manifest/);
  assert.match(cardSource, /MetricValue/);
});

test('healthy load of all six hubs is specialist-owned', async () => {
  const cards = await loadSpecialistNetworkCards({
    fetchImpl: async (url) => {
      if (url.includes('investor-trust-hub')) return jsonResponse(investorFallback);
      throw new Error('use fallback for others in this isolated test');
    },
  });
  assert.equal(Object.keys(cards).sort().join(','), 'contractor,insurance,investor,lender,move,senior');
  assert.equal(cards.investor.hub, 'investor');
});

test('NJ/CA missing state-RIA universes fail closed instead of becoming zero', () => {
  const raw = clone(investorFallback) as Record<string, unknown>;
  (raw.metrics as Array<{ key: string; value: number | null; valueState: string }>).find((metric) => metric.key === 'nj_state_ria_roster')!.value = 0;
  assert.throws(() => validateInvestorManifest(raw), /must not be a number/);
});
