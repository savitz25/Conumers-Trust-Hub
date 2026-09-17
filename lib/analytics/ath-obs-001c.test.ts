import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { sanitizeCaptureResult } from './privacy.ts';

const here = dirname(fileURLToPath(import.meta.url));

test('ATH-OBS-001C: stripping token from before_send is the ingest failure', () => {
  const broken = {
    event: '$pageview',
    properties: {
      token: 'phc_live',
      distinct_id: 'abc',
      query: 'raw ask text',
      $current_url: 'https://www.asktrusthub.com/',
    },
  };
  delete (broken.properties as { token?: string }).token;
  assert.equal(broken.properties.token, undefined);

  const fixed = sanitizeCaptureResult({
    event: '$pageview',
    properties: {
      token: 'phc_live',
      distinct_id: 'abc',
      query: 'raw ask text',
      $current_url: 'https://www.asktrusthub.com/',
      hub: 'ask',
    },
  });
  assert.equal(fixed?.properties?.token, 'phc_live');
  assert.equal(fixed?.properties?.distinct_id, 'abc');
  assert.equal(fixed?.properties?.query, undefined);
  assert.equal(fixed?.event, '$pageview');
});

test('ATH-OBS-001C: Guided results expose data-ath-event hooks', () => {
  const src = readFileSync(join(here, '../../components/guided-research.tsx'), 'utf8');
  assert.match(src, /data-ath-event="search_result_opened"/);
  assert.match(src, /data-ath-event="specialist_handoff_started"/);
  assert.match(src, /SEARCH_SUBMITTED/);
  assert.match(src, /SEARCH_RESULTS_RETURNED/);
});

test('ATH-OBS-001C: pageview effect does not cancel in-flight capture', () => {
  const src = readFileSync(join(here, '../../components/analytics/posthog-root.tsx'), 'utf8');
  const pageviews = src.slice(src.indexOf('function PosthogPageviews'), src.indexOf('function PosthogIdentity'));
  assert.doesNotMatch(pageviews, /cancelled/);
  assert.match(pageviews, /captureSanitizedPageview/);
});
