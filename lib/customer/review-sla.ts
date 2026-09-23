/**
 * ATH-CLAIM-V2-001 — 48 BUSINESS-HOUR internal trial review target.
 *
 * This is an internal operating target, not an external or legal guarantee. Business hours are counted as
 * whole weekday hours (Monday–Friday, UTC). Weekend hours do not count. 48 business hours therefore equals two
 * business days regardless of when a claim arrives.
 */
export const REVIEW_SLA_TARGET_BUSINESS_HOURS = 48;
export const REVIEW_SLA_APPROACHING_BUSINESS_HOURS = 24;

export type ReviewSlaState = 'WITHIN_TARGET' | 'APPROACHING_TARGET' | 'OVER_TARGET' | 'RESOLVED';

const HOUR_MS = 60 * 60 * 1000;

/** Whole weekday hours between two instants (UTC). Partial hours are counted fractionally. */
export function businessHoursBetween(start: Date, end: Date): number {
  if (end.getTime() <= start.getTime()) return 0;
  let total = 0;
  let cursor = start.getTime();
  const stop = end.getTime();
  while (cursor < stop) {
    const day = new Date(cursor).getUTCDay();
    const nextMidnight = Date.UTC(new Date(cursor).getUTCFullYear(), new Date(cursor).getUTCMonth(), new Date(cursor).getUTCDate() + 1);
    const segmentEnd = Math.min(nextMidnight, stop);
    if (day !== 0 && day !== 6) total += (segmentEnd - cursor) / HOUR_MS;
    cursor = segmentEnd;
  }
  return Math.round(total * 100) / 100;
}

export function reviewSlaState(input: { submittedAt: Date; decidedAt?: Date | null; now: Date }): { state: ReviewSlaState; businessHoursOpen: number } {
  if (input.decidedAt) return { state: 'RESOLVED', businessHoursOpen: businessHoursBetween(input.submittedAt, input.decidedAt) };
  const open = businessHoursBetween(input.submittedAt, input.now);
  if (open > REVIEW_SLA_TARGET_BUSINESS_HOURS) return { state: 'OVER_TARGET', businessHoursOpen: open };
  if (open >= REVIEW_SLA_APPROACHING_BUSINESS_HOURS) return { state: 'APPROACHING_TARGET', businessHoursOpen: open };
  return { state: 'WITHIN_TARGET', businessHoursOpen: open };
}

export const REVIEW_SLA_LABEL: Record<ReviewSlaState, string> = {
  WITHIN_TARGET: 'Within 48 business-hour target',
  APPROACHING_TARGET: 'Approaching 48 business-hour target',
  OVER_TARGET: 'Over 48 business-hour target',
  RESOLVED: 'Decided',
};

/** Queue ordering: needs_info first, then oldest submitted, then in_review, then everything else. */
export function openClaimPriority(status: string): number {
  return status === 'needs_info' ? 0 : status === 'submitted' ? 1 : status === 'in_review' ? 2 : 3;
}
