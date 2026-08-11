/**
 * Stage B.2 — situation → ordered multi-hub research path.
 * Ask orchestrates; specialist hubs do the deep work.
 */

import {
  buildInsuranceDeepLink,
  buildLenderDeepLink,
  buildMoveDeepLink,
  hubDisplayName,
  normalizeCountySlug,
  normalizeState,
  placeLabel,
  type JourneyContext,
  type JourneyHub,
  type JourneyIntent,
  type JourneyKind,
} from '@/lib/orchestration/journey-links';

export type SituationId =
  | 'move_buy'
  | 'move_rent'
  | 'buy_local'
  | 'refinance'
  | 'coverage_after_move'
  | 'pure_move'
  | 'unknown';

export type SituationOption = {
  id: SituationId;
  label: string;
  description: string;
  /** Show destination fields */
  needsDestination: boolean;
  /** Show intent is fixed by situation */
  fixedIntent?: JourneyIntent;
};

export const SITUATION_OPTIONS: SituationOption[] = [
  {
    id: 'move_buy',
    label: 'Moving and buying',
    description: 'Relocating and planning to purchase a home',
    needsDestination: true,
    fixedIntent: 'buy',
  },
  {
    id: 'move_rent',
    label: 'Moving and renting',
    description: 'Relocating without a mortgage path as primary',
    needsDestination: true,
    fixedIntent: 'rent',
  },
  {
    id: 'buy_local',
    label: 'Buying a home (local)',
    description: 'Purchase research where you already live',
    needsDestination: true,
    fixedIntent: 'buy',
  },
  {
    id: 'refinance',
    label: 'Refinancing',
    description: 'NMLS-oriented refinance research only',
    needsDestination: true,
    fixedIntent: 'refi',
  },
  {
    id: 'coverage_after_move',
    label: 'Need insurance after a move',
    description: 'Coverage research for a new state',
    needsDestination: true,
    fixedIntent: 'unknown',
  },
  {
    id: 'pure_move',
    label: 'Just researching movers',
    description: 'Mover licensing and destination logistics',
    needsDestination: true,
    fixedIntent: 'unknown',
  },
  {
    id: 'unknown',
    label: 'Not sure yet',
    description: 'Safest useful path — no forced mortgage',
    needsDestination: false,
  },
];

export type PathStep = {
  id: string;
  step: number;
  hub: JourneyHub;
  hubLabel: string;
  title: string;
  why: string;
  cta: string;
  href: string;
};

export type TrustJourneyPlan = {
  situationId: SituationId;
  title: string;
  summary: string;
  context: JourneyContext;
  place: string | null;
  steps: PathStep[];
  clarifyingNote?: string;
};

export type PathInput = {
  situationId: SituationId;
  /** Destination state code, slug, or name */
  state?: string;
  county?: string;
  citySlug?: string;
  /** Origin state (optional, non-PII) — for copy only */
  originState?: string;
  intent?: JourneyIntent;
};

function baseContext(input: PathInput, journey: JourneyKind, intent: JourneyIntent): JourneyContext {
  const st = normalizeState(input.state);
  return {
    src: 'ask',
    journey,
    intent,
    stateSlug: st?.stateSlug,
    stateCode: st?.stateCode,
    stateName: st?.stateName,
    county: normalizeCountySlug(input.county),
    citySlug: input.citySlug?.trim().toLowerCase() || undefined,
  };
}

function step(
  n: number,
  hub: JourneyHub,
  title: string,
  why: string,
  cta: string,
  href: string
): PathStep {
  return {
    id: `${hub}-${n}`,
    step: n,
    hub,
    hubLabel: hubDisplayName(hub),
    title,
    why,
    cta,
    href,
  };
}

function placePhrase(ctx: JourneyContext): string {
  return placeLabel(ctx) ?? 'your destination';
}

/**
 * Generate an ordered Trust Journey plan from a non-PII situation + optional geography.
 */
export function generateTrustJourneyPlan(input: PathInput): TrustJourneyPlan {
  const opt = SITUATION_OPTIONS.find((s) => s.id === input.situationId) ?? SITUATION_OPTIONS[6];
  const intent = opt.fixedIntent ?? input.intent ?? 'unknown';
  const origin = normalizeState(input.originState);

  switch (input.situationId) {
    case 'move_buy': {
      const ctx = baseContext(input, 'relocate', 'buy');
      const place = placePhrase(ctx);
      const steps = [
        step(
          1,
          'move',
          `Understand the destination — ${place}`,
          'Verify movers and logistics before you book a carrier.',
          'Research movers',
          buildMoveDeepLink(ctx)
        ),
        step(
          2,
          'lender',
          `Research financing in ${place}`,
          'NMLS-oriented lenders and Loan Estimate tools for the market you are buying into.',
          'Research local lenders',
          buildLenderDeepLink(ctx)
        ),
        step(
          3,
          'insurance',
          `Prepare coverage for ${place}`,
          'Homeowners insurance is typically required to close — research considerations for the new state.',
          'Research coverage',
          buildInsuranceDeepLink(ctx)
        ),
      ];
      return {
        situationId: 'move_buy',
        title: origin
          ? `Moving ${origin.stateCode} → ${ctx.stateCode ?? place} and planning to buy`
          : `Moving to ${place} and planning to buy`,
        summary:
          'Ordered research: destination logistics, then financing, then coverage. Ask sequences; specialist hubs do the deep work.',
        context: ctx,
        place: placeLabel(ctx),
        steps,
      };
    }

    case 'move_rent': {
      const ctx = baseContext(input, 'relocate', 'rent');
      const place = placePhrase(ctx);
      return {
        situationId: 'move_rent',
        title: `Moving to ${place} and renting`,
        summary:
          'Move research first, then renters and auto coverage — no mortgage path forced as primary.',
        context: ctx,
        place: placeLabel(ctx),
        steps: [
          step(
            1,
            'move',
            `Understand the destination — ${place}`,
            'Research licensed movers and destination logistics.',
            'Research movers',
            buildMoveDeepLink(ctx)
          ),
          step(
            2,
            'insurance',
            `Coverage for renting in ${place}`,
            'Renters and auto coverage considerations for the new state.',
            'Research coverage',
            buildInsuranceDeepLink(ctx)
          ),
        ],
      };
    }

    case 'buy_local': {
      const ctx = baseContext(input, 'purchase', 'buy');
      const place = placePhrase(ctx);
      return {
        situationId: 'buy_local',
        title: `Buying a home in ${place}`,
        summary: 'Financing research first, then homeowners coverage — educational only.',
        context: ctx,
        place: placeLabel(ctx),
        steps: [
          step(
            1,
            'lender',
            `Research mortgages in ${place}`,
            'NMLS-oriented lender research and educational Loan Estimate tools.',
            'Research local lenders',
            buildLenderDeepLink(ctx)
          ),
          step(
            2,
            'insurance',
            `Homeowners coverage for ${place}`,
            'Coverage is typically required to close — research considerations, not a quote funnel.',
            'Research coverage',
            buildInsuranceDeepLink({ ...ctx, journey: 'coverage' })
          ),
        ],
      };
    }

    case 'refinance': {
      const ctx = baseContext(input, 'refi', 'refi');
      const place = placePhrase(ctx);
      return {
        situationId: 'refinance',
        title: `Refinance research${ctx.stateName ? ` — ${ctx.stateName}` : ''}`,
        summary: 'Lender Trust Hub only for this path — NMLS-oriented research, not an application.',
        context: ctx,
        place: placeLabel(ctx),
        steps: [
          step(
            1,
            'lender',
            `Research refinance options in ${place}`,
            'Compare NMLS-oriented lenders and educational refinance tools for your market.',
            'Research lenders',
            buildLenderDeepLink(ctx)
          ),
        ],
      };
    }

    case 'coverage_after_move': {
      const ctx = baseContext(input, 'coverage', intent === 'rent' ? 'rent' : intent === 'buy' ? 'buy' : 'unknown');
      const place = placePhrase(ctx);
      return {
        situationId: 'coverage_after_move',
        title: `Coverage after moving to ${place}`,
        summary: 'Insurance-first path; Move tools remain available if logistics are unfinished.',
        context: ctx,
        place: placeLabel(ctx),
        steps: [
          step(
            1,
            'insurance',
            `Coverage research for ${place}`,
            'Destination coverage considerations with DOI / NAIC pathways — not a quote marketplace.',
            'Research coverage',
            buildInsuranceDeepLink(ctx)
          ),
          step(
            2,
            'move',
            'Still sorting the move?',
            'Optional: verify movers and destination logistics on Move Trust Hub.',
            'Research movers',
            buildMoveDeepLink({ ...ctx, journey: 'relocate' })
          ),
        ],
      };
    }

    case 'pure_move': {
      const ctx = baseContext(input, 'relocate', 'unknown');
      const place = placePhrase(ctx);
      return {
        situationId: 'pure_move',
        title: `Mover research${ctx.stateName ? ` — ${place}` : ''}`,
        summary: 'Move Trust Hub only — FMCSA-oriented research. Add other hubs when housing intent is clear.',
        context: ctx,
        place: placeLabel(ctx),
        steps: [
          step(
            1,
            'move',
            ctx.stateName ? `Research movers for ${place}` : 'Research licensed movers',
            'FMCSA licensing context and destination guides — verify before you book.',
            'Open Move Trust Hub',
            buildMoveDeepLink(ctx)
          ),
        ],
      };
    }

    case 'unknown':
    default: {
      const ctx = baseContext(
        { ...input, state: input.state || undefined },
        'unknown',
        'unknown'
      );
      return {
        situationId: 'unknown',
        title: 'Not sure yet — a safe starting path',
        summary:
          'We do not force mortgage research. Start with destination logistics, then coverage if a move is likely. Refine when you know more.',
        context: ctx,
        place: placeLabel(ctx),
        clarifyingNote:
          'If you are buying, switch to “Moving and buying” or “Buying a home.” If only refinancing, choose “Refinancing.”',
        steps: [
          step(
            1,
            'move',
            'Explore move research (if relocating)',
            'Optional starting point when a move is possible — no account required.',
            'Open Move Trust Hub',
            buildMoveDeepLink(ctx)
          ),
          step(
            2,
            'insurance',
            'Explore coverage research',
            'Useful if your address or housing situation is changing.',
            'Open Insurance Trust Hub',
            buildInsuranceDeepLink(ctx)
          ),
        ],
      };
    }
  }
}

/** Map free-text concierge prompts toward a situation id (no PII). */
export function matchSituationIdFromQuery(raw: string): SituationId | null {
  const q = raw.trim().toLowerCase();
  if (!q) return null;
  if (/\b(refi|refinanc)/.test(q)) return 'refinance';
  if (/\b(rent|renter|renting)\b/.test(q) && /\b(mov|relocat)\b/.test(q)) return 'move_rent';
  if (/\b(buy|buying|purchase|homebuyer)\b/.test(q) && /\b(mov|relocat)\b/.test(q))
    return 'move_buy';
  if (/\b(buy|buying|purchase|homebuyer)\b/.test(q)) return 'buy_local';
  if (/\b(insurance|coverage|premium)\b/.test(q) && /\b(mov|relocat|after)\b/.test(q))
    return 'coverage_after_move';
  if (/\b(mover|moving|relocat|dot|fmcsa)\b/.test(q)) return 'pure_move';
  if (/\b(not sure|unsure|help me)\b/.test(q)) return 'unknown';
  return null;
}
