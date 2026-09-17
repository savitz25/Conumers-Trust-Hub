import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  isAskReplayMaskedEchoLabel,
  sanitizeAnalyticsUrl,
  sanitizeCapturedNetworkRequest,
  sanitizeCaptureResult,
  sanitizePageviewProperties,
} from './privacy.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

test('ATH-OBS-002B: submitted Ask query echoes carry data-ph-mask', () => {
  const routeCard = read('components/ask-research-route-card.tsx');
  assert.match(routeCard, /You asked:[\s\S]{0,80}<span data-ph-mask>\s*\{route\.question\}/);

  const guided = read('components/guided-research.tsx');
  assert.match(guided, /Current research:[\s\S]{0,220}data-ph-mask/);
  assert.match(guided, /You asked:[\s\S]{0,120}<span data-ph-mask>/);
  assert.match(guided, /isAskReplayMaskedEchoLabel\(label\)\s*\?\s*\{\s*'data-ph-mask':\s*true/);
  assert.match(guided, /id="guided-value"[\s\S]{0,220}data-ph-mask="true"/);

  const results = read('components/network-ask-result.tsx');
  assert.match(results, /defaultValue=\{plan\.query\}[\s\S]{0,160}data-ph-mask="true"/);

  const form = read('components/ask-query-form.tsx');
  assert.match(form, /id="ask-q"[\s\S]{0,280}data-ph-mask="true"/);
});

test('ATH-OBS-002B remainder: user geography echoes are masked, public research is not', () => {
  const routeCard = read('components/ask-research-route-card.tsx');
  assert.match(routeCard, /Requested scope:[\s\S]{0,80}<span data-ph-mask>\s*\{route\.requestedScope\}/);
  assert.match(routeCard, /Research scope:[\s\S]{0,80}<span data-ph-mask>\s*\{route\.executionScope\}/);
  assert.match(routeCard, /data-ph-mask>\{route\.explanation\}/);
  assert.match(routeCard, /scopeMeaning\?` — \$\{route\.scopeMeaning\}/);

  const guided = read('components/guided-research.tsx');
  assert.match(guided, /session\.geography\.value/);
  assert.match(guided, /<span data-ph-mask>\{session\.geography\.value\}/);
  assert.match(guided, /<span data-ph-mask>\{session\.executionScope\.executionGeography\.display\}/);
  assert.match(guided, /data-ph-mask>\{session\.executionScope\.disclosure\}/);
  assert.match(guided, /dispatch\.geography[\s\S]{0,80}data-ph-mask|data-ph-mask>\{\[result\.dispatch\.geography/);
  assert.doesNotMatch(guided, /<li[^>]*data-ph-mask/);
  assert.doesNotMatch(guided, /<ol[^>]*data-ph-mask/);
  assert.doesNotMatch(guided, /Why shown:[\s\S]{0,40}data-ph-mask/);
  assert.doesNotMatch(guided, /matching public records[\s\S]{0,40}data-ph-mask/);
  assert.doesNotMatch(guided, /row\.recordedLocation[\s\S]{0,80}data-ph-mask/);

  const results = read('components/network-ask-result.tsx');
  assert.match(results, /isAskReplayMaskedEchoLabel\(row\.label\)/);
  assert.doesNotMatch(results, /Matching options[\s\S]{0,80}data-ph-mask/);
  assert.doesNotMatch(results, /Open research profile[\s\S]{0,40}data-ph-mask/);
  assert.doesNotMatch(results, /Trace \/ provenance[\s\S]{0,40}data-ph-mask/);

  assert.equal(isAskReplayMaskedEchoLabel('You asked'), true);
  assert.equal(isAskReplayMaskedEchoLabel('Research executed'), true);
  assert.equal(isAskReplayMaskedEchoLabel('Requested location'), true);
  assert.equal(isAskReplayMaskedEchoLabel('Requested geography'), true);
  assert.equal(isAskReplayMaskedEchoLabel('Recorded geography'), true);
  assert.equal(isAskReplayMaskedEchoLabel('Location'), true);
  assert.equal(isAskReplayMaskedEchoLabel('Geography (not service territory)'), true);
  assert.equal(isAskReplayMaskedEchoLabel('Source geography'), false);
  assert.equal(isAskReplayMaskedEchoLabel('Geography scope'), false);
  assert.equal(isAskReplayMaskedEchoLabel('Recorded location'), false);
  assert.equal(isAskReplayMaskedEchoLabel('Recorded address'), false);
  assert.equal(isAskReplayMaskedEchoLabel('Specialist'), false);
  assert.equal(isAskReplayMaskedEchoLabel('Why shown'), false);
});

test('ATH-OBS-002B remainder: recording start_url / player URL scrub is wired', () => {
  const init = read('lib/analytics/posthog-browser.ts');
  assert.match(init, /maskTextSelector:\s*'input, textarea, \[contenteditable\], \[data-ph-mask\], \.myth-form, \.myth-auth-card'/);
  assert.match(init, /maskAllInputs:\s*true/);
  assert.match(init, /before_send: \(event\) => sanitizeEvent\(event\)/);
  assert.match(init, /capture_pageview: false/);
  assert.match(init, /maskCapturedNetworkRequestFn:\s*\(request\) => sanitizeCapturedNetworkRequest\(request\)/);

  const startUrl = sanitizeCapturedNetworkRequest({
    name: 'https://www.asktrusthub.com/ask?q=nursing+homes+in+boca+raton&utm_source=x',
  });
  assert.equal(startUrl.name, 'https://www.asktrusthub.com/ask?utm_source=x');
  assert.doesNotMatch(startUrl.name ?? '', /q=/);
  assert.doesNotMatch(startUrl.name ?? '', /boca/i);

  const snapshot = sanitizeCaptureResult({
    event: '$snapshot',
    properties: {
      token: 'phc_test_token',
      distinct_id: 'anon-1',
      $current_url: 'https://www.asktrusthub.com/ask?q=secret+question',
      $snapshot_data: [
        { type: 4, data: { href: 'https://www.asktrusthub.com/ask?q=secret+question', width: 1280, height: 720 } },
      ],
    },
  });
  assert.equal(snapshot?.properties?.$current_url, 'https://www.asktrusthub.com/ask');
  const meta = (snapshot?.properties?.$snapshot_data as Array<{ data: { href: string } }>)[0];
  assert.equal(meta.data.href, 'https://www.asktrusthub.com/ask');
  assert.equal(snapshot?.properties?.token, 'phc_test_token');
});

test('ATH-OBS-002B: public evidence cards are not broadly masked', () => {
  const guided = read('components/guided-research.tsx');
  assert.doesNotMatch(guided, /<li[^>]*data-ph-mask/);
  assert.doesNotMatch(guided, /<ol[^>]*data-ph-mask/);
  assert.doesNotMatch(guided, /Why shown:[\s\S]{0,40}data-ph-mask/);
  assert.doesNotMatch(guided, /matching public records[\s\S]{0,40}data-ph-mask/);

  const results = read('components/network-ask-result.tsx');
  assert.doesNotMatch(results, /Matching options[\s\S]{0,80}data-ph-mask/);
  assert.doesNotMatch(results, /Open research profile[\s\S]{0,40}data-ph-mask/);
  assert.doesNotMatch(results, /Trace \/ provenance[\s\S]{0,40}data-ph-mask/);
});

test('ATH-OBS-002B: event analytics still strip raw q and leave search_submitted intact', () => {
  const event = sanitizeCaptureResult({
    event: 'search_submitted',
    properties: {
      token: 'phc_test_token',
      distinct_id: 'anon-1',
      query: 'secret submitted question',
      q: 'secret submitted question',
      hub: 'ask',
      surface: 'ask_form',
      success: true,
    },
  });
  assert.equal(event?.event, 'search_submitted');
  assert.equal(event?.properties?.token, 'phc_test_token');
  assert.equal(event?.properties?.hub, 'ask');
  assert.equal(event?.properties?.surface, 'ask_form');
  assert.equal(event?.properties?.query, undefined);
  assert.equal(event?.properties?.q, undefined);
});

test('ATH-OBS-002B: URL sanitization remains intact', () => {
  assert.equal(
    sanitizeAnalyticsUrl('https://www.asktrusthub.com/ask?q=who%20owns%20this%20house&utm_source=x'),
    'https://www.asktrusthub.com/ask?utm_source=x',
  );
  const page = sanitizePageviewProperties({
    $pathname: '/ask',
    $title: 'Research: who owns this house | Ask Trust Hub',
    $current_url: 'https://www.asktrusthub.com/ask?q=who%20owns%20this%20house',
    $entry_current_url: 'https://www.asktrusthub.com/ask?q=who%20owns%20this%20house',
  });
  assert.equal(page.$title, 'Ask Trust Hub');
  assert.equal(page.$current_url, 'https://www.asktrusthub.com/ask');
  assert.equal(page.$entry_current_url, 'https://www.asktrusthub.com/ask');
});

test('ATH-OBS-002B: visible Ask copy still renders You asked / Current research for the user', () => {
  const routeCard = read('components/ask-research-route-card.tsx');
  assert.match(routeCard, /You asked:/);
  assert.match(routeCard, /\{route\.question\}/);
  const guided = read('components/guided-research.tsx');
  assert.match(guided, /Current research:/);
  assert.match(guided, /You asked:/);
  assert.match(guided, /\{session\.executionScope\.requestedGeography\.display\}/);
  assert.match(guided, /\{session\.executionScope\.executionGeography\.display\}/);
});
