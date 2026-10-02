/**
 * ATH-CLAIM-V2-001 / ATH-CLAIM-V2-001R2 (Q5, Q6) — internal review target for the trial.
 *
 * Q6: this is a 2-BUSINESS-DAY INTERNAL REVIEW TARGET, counted in weekday hours (Monday–Friday, UTC).
 * Weekends are excluded; holidays are not modeled. It is an internal operating target, not an external or
 * legal SLA, and the prior "48 business hours" label overstated precision the underlying clock never had
 * (no holiday model, UTC-only weekday cut, and — until Q5 — no pause for time spent waiting on the claimant).
 * Do not call this "48 business hours" anywhere user- or docs-facing; call it the 2-business-day target.
 *
 * Q5: needs_info means responsibility sits with the claimant (WAITING_ON_CLAIMANT), so the staff-target clock
 * pauses: `needsInfoEnteredAt` (an open pause) freezes the reported elapsed time at whatever it was when the
 * pause began, and `pausedBusinessHours` (closed pauses already folded into ath_claims by store.ts) is
 * subtracted from the elapsed time once responsibility returns to staff. Staff reminders must never fire for a
 * WAITING_ON_CLAIMANT claim — see reviewQueueReminders in store.ts, which only reminds on OVER_TARGET.
 */
export const REVIEW_TARGET_BUSINESS_DAYS = 2;
export const REVIEW_SLA_TARGET_BUSINESS_HOURS = REVIEW_TARGET_BUSINESS_DAYS * 24;
export const REVIEW_SLA_APPROACHING_BUSINESS_HOURS = REVIEW_SLA_TARGET_BUSINESS_HOURS / 2;

export type ReviewSlaState = 'WITHIN_TARGET' | 'APPROACHING_TARGET' | 'OVER_TARGET' | 'WAITING_ON_CLAIMANT' | 'RESOLVED';

const HOUR_MS = 60 * 60 * 1000;

/** Whole weekday hours between two instants (UTC). Partial hours are counted fractionally. Weekends excluded;
 * holidays are not modeled (documented limitation, not a bug). */
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

export function reviewSlaState(input: {
  submittedAt: Date;
  decidedAt?: Date | null;
  now: Date;
  /** Q5: business hours already spent in CLOSED needs_info pauses (accumulated in ath_claims). */
  pausedBusinessHours?: number;
  /** Q5: set only while a needs_info pause is currently OPEN (ath_claims.needs_info_entered_at). */
  needsInfoEnteredAt?: Date | null;
}): { state: ReviewSlaState; businessHoursOpen: number } {
  const closedPause = input.pausedBusinessHours ?? 0;
  if (input.decidedAt) {
    const raw = businessHoursBetween(input.submittedAt, input.decidedAt);
    return { state: 'RESOLVED', businessHoursOpen: Math.max(0, raw - closedPause) };
  }
  if (input.needsInfoEnteredAt) {
    // The clock is paused: report the elapsed time as of the moment the pause began, not as of `now`.
    const rawAtPauseStart = businessHoursBetween(input.submittedAt, input.needsInfoEnteredAt);
    return { state: 'WAITING_ON_CLAIMANT', businessHoursOpen: Math.max(0, rawAtPauseStart - closedPause) };
  }
  const raw = businessHoursBetween(input.submittedAt, input.now);
  const open = Math.max(0, raw - closedPause);
  if (open > REVIEW_SLA_TARGET_BUSINESS_HOURS) return { state: 'OVER_TARGET', businessHoursOpen: open };
  if (open >= REVIEW_SLA_APPROACHING_BUSINESS_HOURS) return { state: 'APPROACHING_TARGET', businessHoursOpen: open };
  return { state: 'WITHIN_TARGET', businessHoursOpen: open };
}

export const REVIEW_SLA_LABEL: Record<ReviewSlaState, string> = {
  WITHIN_TARGET: 'Within the 2-business-day review target',
  APPROACHING_TARGET: 'Approaching the 2-business-day review target',
  OVER_TARGET: 'Over the 2-business-day review target',
  WAITING_ON_CLAIMANT: 'Waiting on claimant (target paused)',
  RESOLVED: 'Decided',
};

/** Queue ordering: needs_info first, then oldest submitted, then in_review, then everything else. */
export function openClaimPriority(status: string): number {
  return status === 'needs_info' ? 0 : status === 'submitted' ? 1 : status === 'in_review' ? 2 : 3;
}
