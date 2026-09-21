import assert from 'node:assert/strict';
import { test } from 'node:test';
import { specialistHubFromHref } from '../analytics/handoff.ts';
import { buildMoveDeepLink } from '../orchestration/journey-links.ts';
import { buildAskResearchRoute } from './ask-research-route.ts';
import { resolveEntityDestination } from './entity-destination.ts';
import { moveOrigin, PRODUCTION_MOVE_ORIGIN, rewriteMoveSpecialistHref } from './move-origin.ts';
import { switcherEntries } from './registry.ts';

const PREVIEW = 'https://move-trust-fe65g6tam-savitz25-s-projects.vercel.app';

function withOrigin(value: string | undefined, run: () => void) {
  const previous = process.env.NEXT_PUBLIC_MOVE_ORIGIN;
  if (value === undefined) delete process.env.NEXT_PUBLIC_MOVE_ORIGIN;
  else process.env.NEXT_PUBLIC_MOVE_ORIGIN = value;
  try {
    run();
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
    'http://evil.example',
    'https://evil.example',
    'https://move.example.vercel.app/ask',
    'not a url',
  ]) {
    withOrigin(value, () => assert.equal(moveOrigin(), PRODUCTION_MOVE_ORIGIN, value));
  }
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
