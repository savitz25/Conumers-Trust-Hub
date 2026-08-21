/**
 * TRUSTHUB_VISUAL_STANDARD_V1 — canonical bracket + four-point mark geometry.
 * Hub identity = accent color + wordmark only. Never redraw bracket weight per Hub.
 * @see docs/trusthub-network-visual-standard-v1.md §G2
 */

/** Canonical reference: AskNetworkMark viewBox 0 0 36 36 */
export const TH_MARK_VIEWBOX = 36;

/** Bracket stroke as fraction of mark height (2.4 / 36). */
export const TH_MARK_BRACKET_STROKE_RATIO = 2.4 / 36; // ≈ 0.0667

/** Outer node radius / mark height (2.5 / 36). */
export const TH_MARK_OUTER_DOT_R_RATIO = 2.5 / 36; // ≈ 0.0694

/** Center node radius / mark height (2.1 / 36). */
export const TH_MARK_CENTER_DOT_R_RATIO = 2.1 / 36; // ≈ 0.0583

/** Distance from hub center to outer-dot center / mark height (7.8 / 36). */
export const TH_MARK_DOT_SPACING_RATIO = 7.8 / 36; // ≈ 0.2167

/** Crosshair stroke / mark height (1.2 / 36). */
export const TH_MARK_CROSS_STROKE_RATIO = 1.2 / 36;

/**
 * Human-readable lock rule (copy into brand reviews).
 */
export const TH_MARK_CANONICAL_RULE =
  'The bracket-and-four-point TrustHub mark is immutable network geometry. Hub identity changes through accent color and wordmark, not through bracket thickness, proportions, dot geometry or spacing.';

export type ThMarkGeometryStatus =
  | 'canonical'
  | 'match'
  | 'near_match'
  | 'too_heavy'
  | 'mild_heavy'
  | 'architecture_outlier';

export const TH_MARK_HUB_STATUS: Record<
  'ask' | 'move' | 'lender' | 'insurance' | 'contractor' | 'senior' | 'investor',
  { status: ThMarkGeometryStatus; correctionRequired: boolean; note: string }
> = {
  ask: {
    status: 'canonical',
    correctionRequired: false,
    note: 'AskNetworkMark SVG is the reference stroke geometry.',
  },
  move: {
    status: 'match',
    correctionRequired: false,
    note: 'Stroke brackets ~6.5% of mark height — family match.',
  },
  lender: {
    status: 'near_match',
    correctionRequired: true,
    note: 'Raster/PNG-in-SVG; re-export true stroke SVG from canonical ratios.',
  },
  insurance: {
    status: 'architecture_outlier',
    correctionRequired: true,
    note: 'Favicon/icon SVG is shield, not brackets; header PNG near-match.',
  },
  contractor: {
    status: 'too_heavy',
    correctionRequired: true,
    note: 'Filled gold brackets ~16% stem/height — re-export at Contractor visual migration. No CSS fake-fix.',
  },
  senior: {
    status: 'mild_heavy',
    correctionRequired: true,
    note: 'Stroke family but 8% stroke and larger dots — thin to canonical.',
  },
  investor: {
    status: 'too_heavy',
    correctionRequired: true,
    note: 'Stroke ~11.4% of bracket height — thin to canonical at Investor migration.',
  },
};
