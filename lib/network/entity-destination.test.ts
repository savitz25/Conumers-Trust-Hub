import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ENTITY_DESTINATION_CONTRACT,
  resolveEntityDestination,
} from './entity-destination.ts';
import {
  optionsFromInsurancePayload,
  optionsFromInvestorPayload,
  optionsFromLenderPayload,
  optionsFromMovePayload,
  optionsFromSeniorPayload,
  parseContractorAskHtml,
} from './consumer-ask.ts';
import { assembleNetworkAnswer, buildNetworkAskPlan } from './ask-plan.ts';

const ctx = {
  originalQuery: 'highest returns for investment company',
  searchQuery: 'Show SEC-registered RIAs.',
  geography: 'FL',
};

test('unpublished Investor research identity never invents a public /firm profile', () => {
  const dest = resolveEntityDestination(
    {
      hubId: 'investor',
      name: '"TATE ASSET MANAGEMENT" AND "DCO WEALTH MANAGEMENT"',
      entityType: 'ria',
      identifier: { type: 'crd', value: '160657' },
      specialistHref: null,
      publicationNote: 'Research identity — public firm report not currently published.',
    },
    ctx,
  );
  assert.equal(dest.contract, ENTITY_DESTINATION_CONTRACT);
  assert.equal(dest.publicationState, 'research_identity');
  assert.equal(dest.canonicalProfileUrl, undefined);
  assert.match(dest.href, /investortrusthub\.com\/ask/);
  assert.match(dest.href, /Find\+CRD\+160657|Find%20CRD%20160657|q=Find/);
  assert.match(dest.href, /src=asktrusthub/);
  assert.match(dest.href, /from_q=/);
  assert.doesNotMatch(dest.href, /\/firm\//);
  assert.match(dest.ctaLabel, /Research in InvestorTrustHub/);
  assert.equal(dest.stableIdentifier?.type, 'crd');
  assert.equal(dest.stableIdentifier?.value, '160657');
});

test('published specialist href is used as canonical profile and not rewritten from the display name', () => {
  const dest = resolveEntityDestination(
    {
      hubId: 'investor',
      name: 'A Display Name That Would Make A Wrong Slug',
      entityType: 'ria',
      identifier: { type: 'crd', value: '105958' },
      specialistHref: '/firm/sec-crd-105958',
    },
    ctx,
  );
  assert.equal(dest.publicationState, 'public_profile');
  assert.equal(dest.canonicalProfileUrl, 'https://www.investortrusthub.com/firm/sec-crd-105958');
  assert.match(dest.href, /\/firm\/sec-crd-105958/);
  assert.match(dest.href, /src=asktrusthub/);
  assert.doesNotMatch(dest.href, /a-display-name/);
  assert.match(dest.ctaLabel, /View in InvestorTrustHub/);
});

test('unpublished note wins over a supplied profile-looking href', () => {
  const dest = resolveEntityDestination(
    {
      hubId: 'investor',
      name: '&PARTNERS',
      entityType: 'ria',
      identifier: { type: 'crd', value: '3767' },
      specialistHref: '/firm/sec-crd-3767',
      publicationNote: 'Research identity — public firm report not currently published.',
    },
    ctx,
  );
  assert.equal(dest.publicationState, 'research_identity');
  assert.equal(dest.canonicalProfileUrl, undefined);
  assert.doesNotMatch(dest.href, /\/firm\/sec-crd-3767/);
  assert.match(dest.href, /investortrusthub\.com\/ask/);
  assert.match(dest.href, /3767/);
});

test('Move published company profile is canonical', () => {
  const [opt] = optionsFromMovePayload(
    {
      contract: 'move-ask-v1',
      results: [{ name: '1776 MOVING AND STORAGE INC', usdot: '2303737', mc: '1202526', role: 'Carrier', href: '/companies/1776-moving-and-storage-inc' } as never],
    },
    10,
    ctx,
  );
  assert.equal(opt.destination.publicationState, 'public_profile');
  assert.match(opt.destination.href, /movetrusthub\.com\/companies\/1776-moving-and-storage-inc/);
  assert.equal(opt.destination.stableIdentifier?.type, 'usdot');
});

test('Insurance unpublished agency uses NPN Ask handoff, never a fake profile', () => {
  const [opt] = optionsFromInsurancePayload(
    {
      results: [
        {
          name: 'Example Agency',
          npn: '10391484',
          entityClass: 'agency',
          href: null,
          publicationNote: 'Research identity — public graph-agency profile is not currently published.',
        },
      ],
    },
    10,
    ctx,
  );
  assert.equal(opt.destination.entityType, 'agency');
  assert.equal(opt.destination.publicationState, 'research_identity');
  assert.match(opt.destination.href, /insurancetrusthub\.com\/ask/);
  assert.match(opt.destination.href, /NPN/);
  assert.match(opt.destination.href, /10391484/);
  assert.doesNotMatch(opt.destination.href, /\/agenc/);
});

test('Lender public_profile uses specialist href; unpublished identity does not invent /lender/slug', () => {
  const [published] = optionsFromLenderPayload(
    {
      rows: [
        {
          displayName: 'United Wholesale Mortgage',
          metric: 49897,
          lei: '549300HW662MN1WU8550',
          identityStatus: 'public_profile',
          href: '/lender/united-wholesale-mortgage',
          nmls: '3038',
        } as never,
      ],
    },
    10,
    ctx,
  );
  assert.equal(published.destination.publicationState, 'public_profile');
  assert.match(published.destination.href, /lendertrusthub\.com\/lender\/united-wholesale-mortgage/);

  const [hidden] = optionsFromLenderPayload(
    {
      rows: [
        {
          displayName: 'Freedom Mortgage Corporation',
          metric: 1,
          lei: '549300VZVN841I2ILS84',
          identityStatus: 'unpublished_research_identity',
        },
      ],
    },
    10,
    ctx,
  );
  assert.equal(hidden.destination.publicationState, 'research_identity');
  assert.equal(hidden.destination.canonicalProfileUrl, undefined);
  assert.match(hidden.destination.href, /lendertrusthub\.com\/ask/);
  assert.match(hidden.destination.href, /549300VZVN841I2ILS84/);
  assert.doesNotMatch(hidden.destination.href, /\/lender\/freedom/);
});

test('Contractor canonical /contractors/ profile from specialist Ask HTML', () => {
  const html = `
    <article class="cth-intel-card space-y-3">
      <h3 class="text-lg font-semibold">123 ROOFING, INC.</h3>
      <p><span class="font-medium text-[var(--text)]">RC29027885</span> — Registered Roofing Contractor</p>
      <a href="/contractors/rc29027885-123-roofing-inc">View research report</a>
    </article>`;
  const [opt] = parseContractorAskHtml(html, 10, { originalQuery: 'good roofing contractor in broward' });
  assert.equal(opt.destination.publicationState, 'public_profile');
  assert.match(opt.href, /contractortrusthub\.com\/contractors\/rc29027885-123-roofing-inc/);
  assert.equal(opt.destination.stableIdentifier?.value, 'RC29027885');
});

test('Senior unpublished CCN routes to specialist search, not a fabricated /facility slug', () => {
  const [opt] = optionsFromSeniorPayload(
    {
      contract: 'senior-ask-v1',
      results: [{ name: 'Example Nursing Home', ccn: '105502', providerClass: 'nursing_home' }],
    } as never,
    10,
    { originalQuery: 'nursing homes in New Jersey', geography: 'NJ' },
  );
  assert.equal(opt.destination.publicationState, 'research_identity');
  assert.match(opt.destination.href, /seniortrusthub\.com\/search/);
  assert.match(opt.destination.href, /105502/);
  assert.doesNotMatch(opt.destination.href, /\/facility\/example/);
});

test('highest returns query still fails closed on performance and still yields navigable Investor identities', () => {
  const plan = buildNetworkAskPlan('highest returns for investment company');
  assert.equal(plan.hubs[0].hubId, 'investor');
  assert.notEqual(plan.hubs[0].mode, 'fail_closed');
  assert.equal(plan.hubs[0].failKind, 'soft');
  const [opt] = optionsFromInvestorPayload(
    {
      results: [
        {
          firmName: '"THE PILOT\'S ADVISOR," LLC',
          crd: '160241',
          firmType: 'ria',
          href: null,
          publicationNote: 'Research identity — public firm report not currently published.',
        },
      ],
    },
    10,
    { originalQuery: 'highest returns for investment company' },
  );
  assert.ok(opt.destination.href.startsWith('https://www.investortrusthub.com/ask'));
  assert.match(opt.destination.href, /160241/);
  const answer = assembleNetworkAnswer('highest returns for investment company');
  assert.doesNotMatch(JSON.stringify(answer), /best returns|#1 adviser|Trust Score/i);
});

test('bare digits remain fail-closed; unsupported stock picking remains unsupported', () => {
  const bare = buildNetworkAskPlan('160241');
  assert.equal(bare.parsed.identifier?.ambiguous, true);
  const stocks = buildNetworkAskPlan('What stocks should I buy?');
  assert.equal(stocks.hubs[0].mode, 'fail_closed');
});
