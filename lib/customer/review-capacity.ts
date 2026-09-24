/**
 * ATH-CLAIM-V2-001 — review capacity metrics (Section 7).
 *
 * Human review time is the sum of reviewer-declared sessions (`ath_claim_review_sessions`), each capped at
 * REVIEW_SESSION_CAP_SECONDS when it is closed so an abandoned browser tab cannot inflate it. Wall-clock
 * submission→decision is reported separately and is never presented as labor time. No Trust Score, no
 * business quality score: every metric here describes the review operation, not the business.
 */
import { reviewSlaState } from './review-sla.ts';

export const REVIEW_SESSION_CAP_SECONDS = 45 * 60;
export const REVIEW_SESSION_IDLE_EXPIRY_SECONDS = 4 * 60 * 60;

export type ReviewCapacityClaimRow = {
  status: string;
  submittedAt: string;
  reviewStartedAt: string | null;
  reviewDecidedAt: string | null;
  evidenceReadyAtFirstReview: boolean | null;
  humanReviewActiveSeconds: number;
  acquisitionSource: string;
  firstUsefulActionAt?: string | null;
  grantRevokedWithinDays?: number | null;
  /** Q5: needed so a WAITING_ON_CLAIMANT claim is never counted as an OVER_TARGET staff-caused breach. */
  needsInfoEnteredAt?: string | null;
  needsInfoPausedBusinessHours?: number;
};

export type ReviewCapacityMetrics = {
  window: 'all';
  externalClaims: number;
  internalTestClaimsExcluded: number;
  evidenceReadyRate: { numerator: number; denominator: number; percent: number | null };
  medianHumanReviewMinutes: number | null;
  needsInfoRate: { numerator: number; denominator: number; percent: number | null };
  approvalRate: { numerator: number; denominator: number; percent: number | null };
  medianElapsedSubmissionToDecisionHours: number | null;
  firstUsefulActionRate: { numerator: number; denominator: number; percent: number | null };
  wrongGrantIncidents: number;
  unresolvedClaims: number;
  overSlaClaims: number;
};

const DECIDED = new Set(['approved', 'rejected']);
const rate = (numerator: number, denominator: number) => ({ numerator, denominator, percent: denominator ? Math.round((numerator / denominator) * 1000) / 10 : null });
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
}

export function capReviewSession(startedAt: Date, endedAt: Date): number {
  const raw = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
  return Math.min(raw, REVIEW_SESSION_CAP_SECONDS);
}

/** internal_test claims are excluded from every external conversion/capacity metric. */
export function computeReviewCapacity(rows: ReviewCapacityClaimRow[], now: Date): ReviewCapacityMetrics {
  const internal = rows.filter((r) => r.acquisitionSource === 'internal_test');
  const external = rows.filter((r) => r.acquisitionSource !== 'internal_test');
  const reviewed = external.filter((r) => r.reviewStartedAt);
  const decided = external.filter((r) => DECIDED.has(r.status) && r.reviewDecidedAt);
  const approved = external.filter((r) => r.status === 'approved');
  const evidenceKnown = reviewed.filter((r) => r.evidenceReadyAtFirstReview !== null);
  const open = external.filter((r) => !DECIDED.has(r.status) && !['withdrawn', 'superseded'].includes(r.status));
  const overSla = open.filter((r) => reviewSlaState({
    submittedAt: new Date(r.submittedAt),
    decidedAt: null,
    now,
    pausedBusinessHours: r.needsInfoPausedBusinessHours ?? 0,
    needsInfoEnteredAt: r.needsInfoEnteredAt ? new Date(r.needsInfoEnteredAt) : null,
  }).state === 'OVER_TARGET');
  return {
    window: 'all',
    externalClaims: external.length,
    internalTestClaimsExcluded: internal.length,
    evidenceReadyRate: rate(evidenceKnown.filter((r) => r.evidenceReadyAtFirstReview === true).length, evidenceKnown.length),
    medianHumanReviewMinutes: median(decided.filter((r) => r.humanReviewActiveSeconds > 0).map((r) => Math.round((r.humanReviewActiveSeconds / 60) * 10) / 10)),
    needsInfoRate: rate(external.filter((r) => r.status === 'needs_info').length, reviewed.length),
    approvalRate: rate(approved.length, decided.length),
    medianElapsedSubmissionToDecisionHours: median(decided.map((r) => Math.round(((new Date(r.reviewDecidedAt!).getTime() - new Date(r.submittedAt).getTime()) / 3_600_000) * 10) / 10)),
    firstUsefulActionRate: rate(approved.filter((r) => r.firstUsefulActionAt).length, approved.length),
    wrongGrantIncidents: external.filter((r) => typeof r.grantRevokedWithinDays === 'number' && r.grantRevokedWithinDays <= 30).length,
    unresolvedClaims: open.length,
    overSlaClaims: overSla.length,
  };
}
