import { ASK_BRAND } from '@/lib/design/ask-design-system';
import {
  formatMetricValue,
  metricDigitBucket,
  metricValueClassName,
  type MetricValueSize,
} from '@/lib/design/metric-value.ts';

export function MetricValue({
  value,
  size = 'lg',
}: {
  value: number;
  size?: MetricValueSize;
}) {
  const formatted = formatMetricValue(value);
  const bucket = metricDigitBucket(value);
  if (size === 'inline') {
    return (
      <span
        className={metricValueClassName('inline')}
        data-digits={bucket}
        data-size="inline"
      >
        {formatted}
      </span>
    );
  }
  return (
    <div className="metric-value-slot">
      <p
        className={metricValueClassName(size)}
        data-digits={bucket}
        data-size={size}
        style={{ color: ASK_BRAND.navy }}
      >
        {formatted}
      </p>
    </div>
  );
}
