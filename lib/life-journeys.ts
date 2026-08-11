/**
 * Life-journey product framing for Ask Trust Hub.
 * Ordered multi-hub paths — discovery only, no directories on Ask.
 * Stage B.2: prefer generateTrustJourneyPlan() for live contextual deep links.
 */

import { generateTrustJourneyPlan } from '@/lib/orchestration/path-generator';

export type JourneyStep = {
  step: number;
  hubLabel: string;
  why: string;
  href: string;
  cta: string;
};

export type LifeJourney = {
  id: string;
  title: string;
  summary: string;
  steps: JourneyStep[];
};

function stepsFromSituation(
  situationId: 'buy_local' | 'move_buy' | 'coverage_after_move',
  state = 'FL'
): JourneyStep[] {
  const plan = generateTrustJourneyPlan({ situationId, state });
  return plan.steps.map((s) => ({
    step: s.step,
    hubLabel: s.hubLabel,
    why: s.why,
    href: s.href,
    cta: s.cta,
  }));
}

export const LIFE_JOURNEYS: LifeJourney[] = [
  {
    id: 'buying-home',
    title: 'Buying a home',
    summary:
      'Financing first, then homeowners coverage — each step on its specialist hub with Stage A′ context params.',
    steps: stepsFromSituation('buy_local', 'FL'),
  },
  {
    id: 'moving-relocating',
    title: 'Moving / relocating',
    summary:
      'Start with the move, then financing if buying, then coverage — contextual deep links from the path generator.',
    steps: stepsFromSituation('move_buy', 'FL'),
  },
  {
    id: 'protecting-what-i-have',
    title: 'Protecting what I have',
    summary:
      'Insurance-first path for coverage research after a move — optional Move tools when logistics remain open.',
    steps: stepsFromSituation('coverage_after_move', 'FL'),
  },
];
