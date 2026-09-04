import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  formatMetricValue,
  metricDigitBucket,
  metricDigitCount,
  metricValueClassName,
} from './metric-value.ts';

const CASES = [
  [11529787, '11,529,787', 8, 8],
  [2678341, '2,678,341', 7, 7],
  [1248650, '1,248,650', 7, 7],
  [644421, '644,421', 6, 6],
  [499997, '499,997', 6, 6],
  [419479, '419,479', 6, 6],
  [14690, '14,690', 5, 6],
  [6, '6', 1, 6],
] as const;

test('digit buckets follow 6 / 7 / 8+ steps and keep full comma-separated values', () => {
  for (const [value, formatted, digits, bucket] of CASES) {
    assert.equal(formatMetricValue(value), formatted);
    assert.equal(metricDigitCount(value), digits);
    assert.equal(metricDigitBucket(value), bucket);
    assert.doesNotMatch(formatMetricValue(value), /[MBK]$|M\+|million/i);
  }
});

test('shared class names stay size-based, not value-specific', () => {
  assert.equal(metricValueClassName('lg'), 'metric-value metric-value--lg');
  assert.equal(metricValueClassName('md'), 'metric-value metric-value--md');
  assert.equal(metricValueClassName('inline'), 'metric-value metric-value--inline');
});

test('cards use the shared metric value treatment and do not wrap or abbreviate', () => {
  const home = readFileSync(join(process.cwd(), 'components/network-intelligence-home.tsx'), 'utf8');
  const card = readFileSync(join(process.cwd(), 'components/specialist-network-card.tsx'), 'utf8');
  const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
  const component = readFileSync(join(process.cwd(), 'components/metric-value.tsx'), 'utf8');
  for (const source of [home, card]) {
    assert.match(source, /MetricValue/);
    assert.doesNotMatch(source, /text-3xl font-semibold tabular-nums sm:text-4xl/);
    assert.doesNotMatch(source, /2\.7M|11\.5M|1\.2M/);
  }
  assert.match(card, /grid gap-5 sm:gap-6/);
  assert.match(css, /container-type:\s*inline-size/);
  assert.match(css, /white-space:\s*nowrap/);
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /\[data-digits="6"\]/);
  assert.match(css, /\[data-digits="7"\]/);
  assert.match(css, /\[data-digits="8"\]/);
  assert.match(component, /data-digits=\{bucket\}/);
});
