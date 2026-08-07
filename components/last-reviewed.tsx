import { ASK_BRAND } from '@/lib/design/ask-design-system';
import { formatReviewDate } from '@/lib/trust-reviewed';

export function LastReviewed({ date }: { date: string }) {
  return (
    <p
      className="text-sm font-medium"
      style={{ color: ASK_BRAND.ink }}
    >
      <span className="font-semibold" style={{ color: ASK_BRAND.navy }}>
        Last reviewed:
      </span>{' '}
      <time dateTime={date}>{formatReviewDate(date)}</time>
    </p>
  );
}
