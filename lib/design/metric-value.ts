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
