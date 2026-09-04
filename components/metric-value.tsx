import { ASK_BRAND } from '@/lib/design/ask-design-system';
import {
  formatMetricValue,
  metricDigitBucket,
  metricFontSize,
  metricValueClassName,
  type MetricValueSize,
} from '@/lib/design/metric-value.ts';
import styles from './metric-value.module.css';

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
      <span className="font-semibold tabular-nums whitespace-nowrap" data-digits={bucket} data-size="inline">
        {formatted}
      </span>
    );
  }
  return (
    <div className={`min-w-0 max-w-full ${styles.slot}`} style={{ containerType: 'inline-size' }}>
      <p
        className={`${styles.value} ${metricValueClassName(size)} max-w-full overflow-hidden font-semibold tabular-nums whitespace-nowrap`}
        data-digits={bucket}
        data-size={size}
        style={{ color: ASK_BRAND.navy, fontSize: metricFontSize(value, size) }}
      >
        {formatted}
      </p>
    </div>
  );
}
