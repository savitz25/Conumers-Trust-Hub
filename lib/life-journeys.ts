/**
 * Life-journey product framing for Ask Trust Hub.
 * Ordered multi-hub paths — discovery only, no directories on Ask.
 */

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

export const LIFE_JOURNEYS: LifeJourney[] = [
  {
    id: 'buying-home',
    title: 'Buying a home',
    summary:
      'Financing first, then homeowners coverage, then the move — each step on its specialist hub.',
    steps: [
      {
        step: 1,
        hubLabel: 'Lender Trust Hub',
        why: 'Research NMLS-verified lenders before you apply.',
        href: 'https://www.lendertrusthub.com/local-lenders',
        cta: 'Research lenders',
      },
      {
        step: 2,
        hubLabel: 'Insurance Trust Hub',
        why: 'Compare DOI-licensed options for homeowners coverage.',
        href: 'https://www.insurancetrusthub.com/directory',
        cta: 'Research homeowners coverage',
      },
      {
        step: 3,
        hubLabel: 'Move Trust Hub',
        why: 'Verify FMCSA movers and plan the relocation.',
        href: 'https://www.movetrusthub.com/verify-dot',
        cta: 'Research movers',
      },
    ],
  },
  {
    id: 'moving-relocating',
    title: 'Moving / relocating',
    summary:
      'Start with the move, then coverage for the new place — add financing if you are buying.',
    steps: [
      {
        step: 1,
        hubLabel: 'Move Trust Hub',
        why: 'Interstate and local mover research with FMCSA context.',
        href: 'https://www.movetrusthub.com/verify-dot',
        cta: 'Start with movers',
      },
      {
        step: 2,
        hubLabel: 'Insurance Trust Hub',
        why: 'Renters or homeowners research for the destination.',
        href: 'https://www.insurancetrusthub.com/directory',
        cta: 'Research coverage',
      },
      {
        step: 3,
        hubLabel: 'Lender Trust Hub',
        why: 'If purchase follows the move — NMLS lender research.',
        href: 'https://www.lendertrusthub.com/local-lenders',
        cta: 'Research lenders (if buying)',
      },
    ],
  },
  {
    id: 'protecting-what-i-have',
    title: 'Protecting what I have',
    summary:
      'Insurance-first path for coverage research — optional financing or move tools when life changes.',
    steps: [
      {
        step: 1,
        hubLabel: 'Insurance Trust Hub',
        why: 'Independent DOI / NAIC pathways and agent research.',
        href: 'https://www.insurancetrusthub.com/',
        cta: 'Open Insurance Trust Hub',
      },
      {
        step: 2,
        hubLabel: 'Lender Trust Hub',
        why: 'If refinancing or buying — NMLS lender research.',
        href: 'https://www.lendertrusthub.com/local-lenders',
        cta: 'Optional: research lenders',
      },
      {
        step: 3,
        hubLabel: 'Move Trust Hub',
        why: 'If relocating — FMCSA mover research.',
        href: 'https://www.movetrusthub.com/',
        cta: 'Optional: research movers',
      },
    ],
  },
];
