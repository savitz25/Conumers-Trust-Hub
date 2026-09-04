/** Shared State of the Network metric-number treatment. Values stay full and comma-separated. */

export type MetricValueSize = 'lg' | 'md' | 'inline';
export type MetricDigitBucket = 6 | 7 | 8;

export function formatMetricValue(value: number): string {
  return value.toLocaleString('en-US');
}

export function metricDigitCount(value: number): number {
  return String(Math.trunc(Math.abs(value))).length;
}

export function metricDigitBucket(value: number): MetricDigitBucket {
  const digits = metricDigitCount(value);
  if (digits >= 8) return 8;
  if (digits === 7) return 7;
  return 6;
}

export function metricValueClassName(size: MetricValueSize): string {
  return `metric-value metric-value--${size}`;
}

const LG_CLAMP: Record<MetricDigitBucket, string> = {
  6: 'clamp(1.5rem, 12.5cqi, 2.25rem)',
  7: 'clamp(1.25rem, 10.5cqi, 1.75rem)',
  8: 'clamp(1.125rem, 9.5cqi, 1.5rem)',
};

const MD_CLAMP: Record<MetricDigitBucket, string> = {
  6: 'clamp(1.25rem, 14cqi, 1.5rem)',
  7: 'clamp(1.125rem, 12cqi, 1.375rem)',
  8: 'clamp(1rem, 10cqi, 1.1875rem)',
};

export function metricFontSize(value: number, size: MetricValueSize): string | undefined {
  if (size === 'inline') return undefined;
  const bucket = metricDigitBucket(value);
  return size === 'md' ? MD_CLAMP[bucket] : LG_CLAMP[bucket];
}
