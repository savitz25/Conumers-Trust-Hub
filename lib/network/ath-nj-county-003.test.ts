import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { classifyNjHub, queryLooksLikeNewJersey, routeNjAsk } from './nj-network.ts';
import {
  NJ_COUNTY_MANIFEST,
  dedicatedCountyPage,
  detectNjPilotCountySlug,
  isNjPilotCountySlug,
  njCountyPilotComplete,
  njCountySpecialistUrl,
  seniorCountyGatePassed,
  type NjPilotCountySlug,
} from './nj-counties.ts';

test('ATH-NJ-COUNTY-003 senior release gate is flipped', () => {
  assert.equal(seniorCountyGatePassed(), true);
  assert.equal(njCountyPilotComplete(), true);
  assert.equal(NJ_COUNTY_MANIFEST.release_gate.senior, true);
  assert.equal(NJ_COUNTY_MANIFEST.release_gate.passed, true);
  assert.equal(NJ_COUNTY_MANIFEST.release_gate.blocker, null);
  for (const row of NJ_COUNTY_MANIFEST.counties) {
    assert.equal(isNjPilotCountySlug(row.county_slug), true);
    const slug = row.county_slug as NjPilotCountySlug;
    assert.equal(row.specialist_routes.senior.dedicated_county_page, true);
    assert.equal(
      row.specialist_routes.senior.url,
      `https://www.seniortrusthub.com/new-jersey/${slug}`,
    );
    assert.equal(dedicatedCountyPage('senior', slug), true);
    assert.equal(dedicatedCountyPage('contractor', slug), true);
    assert.equal(dedicatedCountyPage('lender', slug), true);
    assert.equal(dedicatedCountyPage('insurance', slug), false);
    assert.equal(dedicatedCountyPage('move', slug), false);
    assert.equal(dedicatedCountyPage('investor', slug), false);
  }
});

test('ATH-NJ-COUNTY-003 12-question NJ county stress test', () => {
  const cases = [
    {
      q: 'Show contractor research in Monmouth County NJ',
      state: 'NJ',
      county: 'monmouth-county',
      hub: 'contractor',
      dest: 'https://www.contractortrusthub.com/new-jersey/monmouth-county',
      caveat: /permits or projects/i,
    },
    {
      q: 'Find contractor research in Middlesex County',
      state: 'NJ',
      county: 'middlesex-county',
      hub: 'contractor',
      dest: 'https://www.contractortrusthub.com/new-jersey/middlesex-county',
      caveat: /permits or projects/i,
    },
    {
      q: 'What does mortgage activity look like in Somerset County?',
      state: 'NJ',
      county: 'somerset-county',
      hub: 'lender',
      dest: 'https://www.lendertrusthub.com/new-jersey/somerset-county',
      caveat: /not a New Jersey mortgage-license roster/i,
    },
    {
      q: 'What does mortgage activity look like in Union County?',
      state: 'NJ',
      county: 'union-county',
      hub: 'lender',
      dest: 'https://www.lendertrusthub.com/new-jersey/union-county',
      caveat: /not a New Jersey mortgage-license roster/i,
    },
    {
      q: 'Find senior care in Monmouth County NJ',
      state: 'NJ',
      county: 'monmouth-county',
      hub: 'senior',
      dest: 'https://www.seniortrusthub.com/new-jersey/monmouth-county',
      caveat: /office location is not a service area/i,
    },
    {
      q: 'Find senior-care information in Middlesex County',
      state: 'NJ',
      county: 'middlesex-county',
      hub: 'senior',
      dest: 'https://www.seniortrusthub.com/new-jersey/middlesex-county',
      caveat: /office location is not a service area/i,
    },
    {
      q: 'Find senior care in Somerset County NJ',
      state: 'NJ',
      county: 'somerset-county',
      hub: 'senior',
      dest: 'https://www.seniortrusthub.com/new-jersey/somerset-county',
      caveat: /office location is not a service area/i,
    },
    {
      q: 'Senior resources in Union County',
      state: 'NJ',
      county: 'union-county',
      hub: 'senior',
      dest: 'https://www.seniortrusthub.com/new-jersey/union-county',
      caveat: /office location is not a service area/i,
    },
    {
      q: 'What insurance research is available for Monmouth County?',
      state: 'NJ',
      county: 'monmouth-county',
      hub: 'insurance',
      dest: /insurancetrusthub\.com\/new-jersey\?.*county=monmouth/,
      caveat: /complaint is not a violation/i,
    },
    {
      q: 'How do I verify a mover for a move inside Middlesex County?',
      state: 'NJ',
      county: 'middlesex-county',
      hub: 'move',
      dest: /movetrusthub\.com\/new-jersey\?.*county=middlesex/,
      caveat: /not FMCSA interstate authority/i,
    },
    {
      q: 'Find an investment adviser in Union County',
      state: 'NJ',
      county: 'union-county',
      hub: 'investor',
      dest: /investortrusthub\.com\/new-jersey\?.*county=union/,
      caveat: /not the complete New Jersey state-RIA universe/i,
    },
    {
      q: 'Is this mover licensed in New Jersey?',
      state: 'NJ',
      county: undefined,
      hub: 'move',
      dest: 'https://www.movetrusthub.com/new-jersey',
      caveat: /not FMCSA interstate authority/i,
    },
  ] as const;

  for (const row of cases) {
    assert.equal(queryLooksLikeNewJersey(row.q), true, row.q);
    assert.equal(classifyNjHub(row.q), row.hub, row.q);
    assert.equal(detectNjPilotCountySlug(row.q), row.county, row.q);
    const routed = routeNjAsk(row.q);
    assert.equal(routed?.stateCode, row.state, row.q);
    assert.equal(routed?.hubId, row.hub, row.q);
    if (typeof row.dest === 'string') {
      assert.equal(routed?.destination, row.dest, row.q);
    } else {
      assert.match(routed!.destination, row.dest, row.q);
    }
    assert.match(routed!.caveat, row.caveat, row.q);
    if (row.hub === 'senior' && row.county) {
      const plan = buildNetworkAskPlan(row.q);
      assert.equal(plan.parsed.geography?.stateCode, 'NJ', row.q);
      assert.equal(plan.parsed.geography?.countySlug, row.county, row.q);
      assert.equal(plan.hubs[0]?.hubId, 'senior', row.q);
      assert.equal(plan.hubs[0]?.destination, row.dest, row.q);
    }
  }

  const bergenSenior = routeNjAsk('Find senior care in Bergen County NJ');
  assert.equal(bergenSenior?.hubId, 'senior');
  assert.equal(bergenSenior?.destination, 'https://www.seniortrusthub.com/new-jersey');
  assert.equal(njCountySpecialistUrl('senior'), 'https://www.seniortrusthub.com/new-jersey');
});
