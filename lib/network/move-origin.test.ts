import assert from 'node:assert/strict';
import { test } from 'node:test';
import { specialistHubFromHref } from '../analytics/handoff.ts';
import { buildMoveDeepLink } from '../orchestration/journey-links.ts';
import { buildAskResearchRoute } from './ask-research-route.ts';
import { resolveEntityDestination } from './entity-destination.ts';
import { moveOrigin, PRODUCTION_MOVE_ORIGIN, rewriteMoveSpecialistHref } from './move-origin.ts';
import { switcherEntries } from './registry.ts';

const PREVIEW = 'https://move-trust-fe65g6tam-savitz25-s-projects.vercel.app';

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
    'https://move-trust-attacker-savitz25-s-projects.vercel.app',
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
