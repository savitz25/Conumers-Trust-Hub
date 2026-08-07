import { ASK_BRAND } from '@/lib/design/ask-design-system';
import { formatReviewDate } from '@/lib/trust-reviewed';

export function LastReviewed({ date }: { date: string }) {
  return (
    <p
      className="inline-flex flex-wrap items-center gap-x-1.5 rounded-lg border px-3 py-2 text-sm font-medium"
      style={{
        color: ASK_BRAND.ink,
        borderColor: ASK_BRAND.border,
        backgroundColor: ASK_BRAND.white,
      }}
    >
      <span className="font-semibold" style={{ color: ASK_BRAND.navy }}>
        Last reviewed:
      </span>{' '}
      <time dateTime={date} style={{ color: ASK_BRAND.navy }}>
        {formatReviewDate(date)}
      </time>
    </p>
  );
}
