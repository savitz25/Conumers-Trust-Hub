import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAskClick, specialistHubFromHref } from './handoff.ts';
import { stripForbiddenProperties } from './privacy.ts';

const ORIGIN = 'https://www.asktrusthub.com';

test('Move specialist outbound result link emits handoff and keeps result-open', () => {
  const events = classifyAskClick({
    href: 'https://www.movetrusthub.com/companies/source-mover',
    currentOrigin: ORIGIN,
    athEvent: 'search_result_opened',
    athHub: 'move',
    athSurface: 'ask_results',
  });
  assert.equal(events.searchResultOpened?.specialistHub, 'move');
  assert.equal(events.searchResultOpened?.surface, 'ask_results');
  assert.equal(events.specialistHandoff?.specialistHub, 'move');
  assert.equal(events.specialistHandoff?.surface, 'ask_results');
});

test('Senior specialist outbound result link emits specialist_handoff_started', () => {
  const events = classifyAskClick({
    href: 'https://www.seniortrusthub.com/providers/nursing-home/105502',
    currentOrigin: ORIGIN,
    athEvent: 'search_result_opened',
    athHub: 'senior',
    athSurface: 'GUIDED',
  });
  assert.equal(events.searchResultOpened?.specialistHub, 'senior');
  assert.equal(events.specialistHandoff?.specialistHub, 'senior');
});

test('ordinary internal Ask links do not emit specialist_handoff_started', () => {
  const ask = classifyAskClick({
    href: '/ask?q=roofing+in+Broward',
    currentOrigin: ORIGIN,
  });
  assert.equal(ask.specialistHandoff, undefined);
  assert.equal(ask.searchResultOpened, undefined);

  const sameHost = classifyAskClick({
    href: 'https://www.asktrusthub.com/methodology',
    currentOrigin: ORIGIN,
  });
  assert.equal(sameHost.specialistHandoff, undefined);

  const hash = classifyAskClick({ href: '#ask', currentOrigin: ORIGIN });
  assert.equal(hash.specialistHandoff, undefined);
});

test('explicit specialist_handoff_started tag still fires without double classification loss', () => {
  const events = classifyAskClick({
    href: 'https://www.movetrusthub.com/verify-dot',
    currentOrigin: ORIGIN,
    athEvent: 'specialist_handoff_started',
    athHub: 'move',
    athSurface: 'ask_results',
  });
  assert.equal(events.searchResultOpened, undefined);
  assert.equal(events.specialistHandoff?.specialistHub, 'move');
});

test('search_result_opened stays intact for tagged internal-looking relative specialist URLs via hostname', () => {
  assert.equal(specialistHubFromHref('https://www.movetrusthub.com/florida', ORIGIN), 'move');
  assert.equal(specialistHubFromHref('https://www.seniortrusthub.com/', ORIGIN), 'senior');
  assert.equal(specialistHubFromHref('/guides/verify-usdot-number', ORIGIN), null);
  assert.equal(specialistHubFromHref('https://www.asktrusthub.com/ask', ORIGIN), null);
});

test('handoff properties stay inside the privacy contract', () => {
  const props = stripForbiddenProperties({
    hub: 'ask',
    environment: 'production',
    surface: 'ask_results',
    specialist_hub: 'move',
    success: true,
    href: 'https://www.movetrusthub.com/companies/secret',
    query: 'Find USDOT 3244649',
    email: 'a@b.c',
  });
  assert.deepEqual(props, {
    hub: 'ask',
    environment: 'production',
    surface: 'ask_results',
    specialist_hub: 'move',
    success: true,
  });
});
