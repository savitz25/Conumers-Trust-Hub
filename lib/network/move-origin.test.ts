import assert from 'node:assert/strict';
import { test } from 'node:test';
import { specialistHubFromHref } from '../analytics/handoff.ts';
import { buildMoveDeepLink } from '../orchestration/journey-links.ts';
import { buildAskResearchRoute } from './ask-research-route.ts';
import { resolveEntityDestination } from './entity-destination.ts';
import { orchestrateGuidedResearch } from '../guided-research/orchestrator.ts';
import { moveOrigin, PRODUCTION_MOVE_ORIGIN, rewriteMoveSpecialistHref } from './move-origin.ts';
import { switcherEntries } from './registry.ts';

const PREVIEW = 'https://move-trust-hg9c479w8-savitz25-s-projects.vercel.app';
const PREVIOUS_PREVIEW = 'https://move-trust-fe65g6tam-savitz25-s-projects.vercel.app';

function withEnv(name: string, value: string | undefined, run: () => void) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

function withOrigin(value: string | undefined, run: () => void) {
  withEnv('NEXT_PUBLIC_MOVE_ORIGIN', value, run);
}

async function withOriginAsync(value: string | undefined, run: () => Promise<void>) {
  const previous = process.env.NEXT_PUBLIC_MOVE_ORIGIN;
  if (value === undefined) delete process.env.NEXT_PUBLIC_MOVE_ORIGIN;
  else process.env.NEXT_PUBLIC_MOVE_ORIGIN = value;
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_MOVE_ORIGIN;
    else process.env.NEXT_PUBLIC_MOVE_ORIGIN = previous;
  }
}

test('unset and production env keep the production Move host', () => {
  withOrigin(undefined, () => {
    assert.equal(moveOrigin(), PRODUCTION_MOVE_ORIGIN);
    const href = 'https://www.movetrusthub.com/florida?src=ask&journey=relocate&state=FL';
    assert.equal(rewriteMoveSpecialistHref(href), href);
  });
  withOrigin('https://www.movetrusthub.com/', () => {
    assert.equal(moveOrigin(), PRODUCTION_MOVE_ORIGIN);
    assert.match(rewriteMoveSpecialistHref('https://movetrusthub.com/ask?q=movers+in+Florida'), /www\.movetrusthub\.com\/ask\?q=movers\+in\+Florida|movetrusthub\.com\/ask\?q=movers\+in\+Florida/);
  });
  withOrigin(PRODUCTION_MOVE_ORIGIN, () => {
    const route = buildAskResearchRoute('movers in Florida');
    const florida = route.destinations.find((row) => row.id === 'move.florida');
    assert.match(florida?.href ?? '', /^https:\/\/www\.movetrusthub\.com\/florida/);
  });
});

test('invalid Move origins fall back to production', () => {
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,hello',
    'http://evil.example',
    'https://evil.example',
    'https://move.example.vercel.app/ask',
    'https://attacker.vercel.app',
    'https://move-trust-hg9c479w8.vercel.app',
    'https://move-trust-hg9c479w8-other-team.vercel.app',
    'https://not-move-trust-hg9c479w8-savitz25-s-projects.vercel.app',
    `${PREVIEW}.evil.example`,
    `${PREVIEW}:444`,
    `${PREVIEW}/..`,
    `${PREVIEW}/%2e%2e`,
    `${PREVIEW}/path/..`,
    `${PREVIEW}\\`,
    `${PREVIEW}?origin=https://evil.example`,
    `${PREVIEW}#fragment`,
    PREVIEW.replace('https://', '//'),
    PREVIEW.replace('https://', 'http://'),
    PREVIEW.replace('https://', 'https://user:password@'),
    PREVIEW.replace('move-trust', 'move-%74rust'),
    PREVIEW.replace('move-trust', 'move-\ntrust'),
    'not a url',
  ]) {
    withOrigin(value, () => assert.equal(moveOrigin(), PRODUCTION_MOVE_ORIGIN, value));
  }
});

test('localhost requires explicit local development and cannot trust lookalike hosts', () => {
  for (const mode of [undefined, 'test', 'production']) {
    withEnv('NODE_ENV', mode, () => {
      for (const origin of ['http://localhost:3001', 'https://127.0.0.1:4312']) {
        withOrigin(origin, () => assert.equal(moveOrigin(), PRODUCTION_MOVE_ORIGIN));
      }
    });
  }
  withEnv('NODE_ENV', 'development', () => {
    for (const origin of ['http://localhost:3001', 'https://127.0.0.1:4312']) {
      withOrigin(origin, () => assert.equal(moveOrigin(), origin));
    }
    for (const origin of ['http://localhost.evil.example:3001', 'http://127.1:3001', 'http://localhost:99999', 'http://localhost:3001/path']) {
      withOrigin(origin, () => assert.equal(moveOrigin(), PRODUCTION_MOVE_ORIGIN));
    }
  });
});

test('approved origin preserves route/query/hash; query values cannot choose the destination', () => {
  withOrigin(`${PREVIEW}/`, () => {
    const source = 'https://www.movetrusthub.com/companies/example-movers?src=ask&journey=relocate&state=FL&intent=buy&from_q=movers+in+Florida&geo=FL&id=1002530&origin=https%3A%2F%2Fevil.example#authority';
    const target = new URL(rewriteMoveSpecialistHref(source));
    const original = new URL(source);
    assert.equal(target.origin, PREVIEW);
    assert.equal(target.pathname, original.pathname);
    assert.equal(target.search, original.search);
    assert.equal(target.hash, original.hash);
    assert.equal(specialistHubFromHref(`${PREVIEW}:444/companies/example`, 'https://www.asktrusthub.com'), null);
    assert.equal(specialistHubFromHref(PREVIEW.replace('https:', 'http:'), 'https://www.asktrusthub.com'), null);
  });
});

test('other hubs and official external sources remain byte-for-byte unchanged', () => {
  withOrigin(PREVIEW, () => {
    for (const href of [
      'https://www.lendertrusthub.com/florida?q=loans',
      'https://www.insurancetrusthub.com/providers/example',
      'https://www.contractortrusthub.com/contractors/example',
      'https://www.seniortrusthub.com/facility/example',
      'https://www.investortrusthub.com/firm/example',
      'https://safer.fmcsa.dot.gov/query.asp?query_param=USDOT&query_string=1002530',
      'https://data.transportation.gov/resource/az4n-8mr2.json?dot_number=1002530',
    ]) assert.equal(rewriteMoveSpecialistHref(href), href);
  });
});

test('preview Move origin retargets Ask specialist handoffs and keeps handoff context', () => {
  withOrigin(PREVIEW, () => {
    assert.equal(moveOrigin(), PREVIEW);
    const route = buildAskResearchRoute('movers in Florida');
    const moveLinks = route.destinations.filter((row) => row.hub === 'move' && row.owner === 'TRUSTHUB');
    assert.ok(moveLinks.length > 0);
    for (const row of moveLinks) {
      assert.equal(new URL(row.href).origin, PREVIEW, row.id);
      assert.doesNotMatch(row.href, /movetrusthub\.com/);
    }
    const ask = moveLinks.find((row) => new URL(row.href).pathname === '/ask');
    assert.ok(ask);
    assert.equal(new URL(ask.href).searchParams.get('q'), 'movers in Florida');
    assert.equal(rewriteMoveSpecialistHref('https://www.lendertrusthub.com/florida'), 'https://www.lendertrusthub.com/florida');
    assert.equal(
      rewriteMoveSpecialistHref('https://www.fmcsa.dot.gov/protect-your-move/search-mover'),
      'https://www.fmcsa.dot.gov/protect-your-move/search-mover',
    );

    const journey = buildMoveDeepLink({
      src: 'ask',
      journey: 'relocate',
      stateCode: 'FL',
      stateSlug: 'florida',
      stateName: 'Florida',
      intent: 'buy',
    });
    const journeyUrl = new URL(journey);
    assert.equal(journeyUrl.origin, PREVIEW);
    assert.equal(journeyUrl.searchParams.get('src'), 'ask');
    assert.equal(journeyUrl.searchParams.get('journey'), 'relocate');
    assert.equal(journeyUrl.searchParams.get('state'), 'FL');
    assert.equal(journeyUrl.searchParams.get('intent'), 'buy');

    const dest = resolveEntityDestination(
      {
        hubId: 'move',
        name: 'Example Movers',
        entityType: 'carrier',
        identifier: { type: 'usdot', value: '3244649' },
        specialistHref: 'https://www.movetrusthub.com/companies/example-movers',
      },
      { originalQuery: 'movers in Florida', geography: 'FL' },
    );
    const profile = new URL(dest.href);
    assert.equal(profile.origin, PREVIEW);
    assert.equal(profile.pathname, '/companies/example-movers');
    assert.equal(profile.searchParams.get('src'), 'asktrusthub');
    assert.equal(profile.searchParams.get('from_q'), 'movers in Florida');
    assert.equal(profile.searchParams.get('geo'), 'FL');
    assert.equal(profile.searchParams.get('id'), '3244649');
    assert.equal(new URL(dest.canonicalProfileUrl ?? '').origin, PREVIEW);
    assert.equal(specialistHubFromHref(`${PREVIEW}/companies/example-movers`, 'https://conumers-trust-q6b02y81x-savitz25-s-projects.vercel.app'), 'move');
    assert.equal(switcherEntries().find((hub) => hub.id === 'move')?.url, PREVIEW);
  });
});

test('this project Move preview deployments stay allowlisted across deployment ids', () => {
  for (const origin of [PREVIEW, PREVIOUS_PREVIEW, 'https://move-trust-attacker-savitz25-s-projects.vercel.app']) {
    withOrigin(origin, () => {
      assert.equal(moveOrigin(), origin);
      const href = rewriteMoveSpecialistHref('https://www.movetrusthub.com/florida?src=ask&state=FL');
      assert.equal(new URL(href).origin, origin);
      assert.equal(new URL(href).searchParams.get('src'), 'ask');
    });
  }
});

test('movers in Florida profile and next-action hrefs honor the preview Move origin', async () => {
  const original = globalThis.fetch;
  const profile = 'https://www.movetrusthub.com/companies/source-florida-movers?src=ask&from_q=movers+in+Florida&geo=FL';
  globalThis.fetch = (async () => new Response(JSON.stringify({
    contract: 'trusthub-specialist-execution-v2',
    contractVersion: 'move-ask-v1',
    resultType: 'SUPPORTED_RESULTS',
    rows: [{
      publicDisplayName: 'Source Florida Movers LLC',
      usdot: '1234567',
      role: 'Carrier',
      recordedHq: { raw: 'Tampa, FL' },
      authorityState: 'active',
      canonicalProfileUrl: profile,
    }],
    total: 37,
    pagination: { page: 1, limit: 10, totalPages: 4 },
    provenance: {},
    limitations: [],
  }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  try {
    await withOriginAsync(PREVIEW, async () => {
      const response = await orchestrateGuidedResearch({ action: { type: 'START', question: 'movers in Florida' } });
      const rows = response.result?.rows ?? [];
      assert.ok(rows.length > 0, 'movers in Florida must return a profile row');
      for (const row of rows) {
        const href = row.destination?.href;
        assert.ok(href, 'profile destination href is required');
        const url = new URL(href);
        assert.equal(url.origin, PREVIEW, 'profile href must use NEXT_PUBLIC_MOVE_ORIGIN');
        assert.equal(url.pathname, '/companies/source-florida-movers');
        assert.equal(url.searchParams.get('src'), 'ask');
        assert.equal(url.searchParams.get('from_q'), 'movers in Florida');
        assert.equal(url.searchParams.get('geo'), 'FL');
        assert.doesNotMatch(href, /movetrusthub\.com/);
      }
      const next = (response.result?.nextActions ?? []).filter((action) => action.href);
      assert.ok(next.length > 0, 'next-action cards must include Move handoffs');
      for (const action of next) {
        const url = new URL(action.href!);
        if (url.hostname.endsWith('fmcsa.dot.gov') || url.hostname === 'data.transportation.gov') {
          assert.doesNotMatch(action.href!, /vercel\.app/);
          continue;
        }
        assert.equal(url.origin, PREVIEW, action.id);
        assert.doesNotMatch(action.href!, /movetrusthub\.com/);
      }
      const ask = next.find((action) => new URL(action.href!).pathname === '/ask');
      assert.ok(ask, 'next actions include the Move ask handoff');
      assert.equal(new URL(ask.href!).searchParams.get('q'), 'movers in Florida');
    });
    await withOriginAsync(undefined, async () => {
      const response = await orchestrateGuidedResearch({ action: { type: 'START', question: 'movers in Florida' } });
      assert.match(response.result?.rows[0]?.destination?.href ?? '', /^https:\/\/www\.movetrusthub\.com\/companies\/source-florida-movers/);
      for (const action of response.result?.nextActions ?? []) {
        if (!action.href) continue;
        const host = new URL(action.href).hostname;
        if (host.endsWith('fmcsa.dot.gov') || host === 'data.transportation.gov') continue;
        assert.equal(new URL(action.href).origin, PRODUCTION_MOVE_ORIGIN, action.id);
      }
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('clearing the preview origin restores production Move handoffs', () => {
  withOrigin(undefined, () => {
    const route = buildAskResearchRoute('movers in Florida');
    const florida = route.destinations.find((row) => row.id === 'move.florida');
    assert.match(florida?.href ?? '', /^https:\/\/www\.movetrusthub\.com\/florida/);
    assert.equal(switcherEntries().find((hub) => hub.id === 'move')?.url, PRODUCTION_MOVE_ORIGIN);
    assert.equal(specialistHubFromHref(`${PREVIEW}/companies/example-movers`, 'https://www.asktrusthub.com'), null);
    assert.equal(specialistHubFromHref('https://www.movetrusthub.com/florida', 'https://www.asktrusthub.com'), 'move');
  });
});
