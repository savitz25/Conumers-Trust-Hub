/**
 * Homepage situation router — discovery only.
 * Routes users to specialist hubs/tools. No directories or PII on Ask.
 */

export type ChecklistStep = {
  step: number;
  label: string;
  href: string;
  hubLabel: string;
};

export type SituationRoute = {
  id: string;
  title: string;
  detail: string;
  hubLabel: string;
  /** Primary destination when no checklist */
  href?: string;
  cta: string;
  hubTag: 'move' | 'insurance' | 'lender' | 'network' | 'multi';
  /** Buying-a-home style ordered outbound links */
  checklist?: ChecklistStep[];
};

export const SITUATION_PROMPT = 'What are you preparing for?' as const;

export const SITUATION_SUBCOPY =
  'Independent research · no paid placements · we route you to the right specialist hub' as const;

/**
 * Situation cards (static links only — no forms, no PII).
 * Deep links verified against live specialist hosts.
 */
export const SITUATIONS: SituationRoute[] = [
  {
    id: 'moving-scam-risk',
    title: "I'm moving and don't want to get scammed",
    detail: 'Research FMCSA-licensed movers and verify USDOT authority before you book.',
    hubLabel: 'Move Trust Hub',
    href: 'https://www.movetrusthub.com/verify-dot',
    cta: 'Research movers',
    hubTag: 'move',
  },
  {
    id: 'lender-legit',
    title: 'I need to know if this lender is legit',
    detail:
      'Cross-check NMLS licensing and public risk signals for mortgage lenders in your market.',
    hubLabel: 'Lender Trust Hub',
    href: 'https://www.lendertrusthub.com/local-lenders',
    cta: 'Check a lender',
    hubTag: 'lender',
  },
  {
    id: 'premium-or-medicare',
    title: 'My premium jumped / I’m turning 65',
    detail:
      'Educational ACA and Medicare research on Insurance Trust Hub — not a policy marketplace.',
    hubLabel: 'Insurance Trust Hub',
    href: 'https://www.insurancetrusthub.com/tools/medicare-plan-finder',
    cta: 'Research coverage options',
    hubTag: 'insurance',
  },
  {
    id: 'buying-home',
    title: "I'm buying a home",
    detail:
      'Ordered research path: financing first, then homeowners coverage, then the move — each on its specialist hub.',
    hubLabel: 'Multi-hub path',
    cta: 'Start with lenders',
    hubTag: 'multi',
    checklist: [
      {
        step: 1,
        label: 'Research licensed mortgage lenders (NMLS)',
        href: 'https://www.lendertrusthub.com/local-lenders',
        hubLabel: 'Lender Trust Hub',
      },
      {
        step: 2,
        label: 'Research homeowners / property coverage agents (DOI)',
        href: 'https://www.insurancetrusthub.com/directory',
        hubLabel: 'Insurance Trust Hub',
      },
      {
        step: 3,
        label: 'Research FMCSA movers and verify DOT',
        href: 'https://www.movetrusthub.com/verify-dot',
        hubLabel: 'Move Trust Hub',
      },
    ],
  },
  {
    id: 'relocating-work',
    title: "I'm relocating for work / moving cross-country",
    detail:
      'Long-distance move research plus renters or homeowners coverage checks on the specialist hubs.',
    hubLabel: 'Move + Insurance',
    cta: 'Start with interstate movers',
    hubTag: 'multi',
    checklist: [
      {
        step: 1,
        label: 'Interstate movers & DOT verification',
        href: 'https://www.movetrusthub.com/verify-dot',
        hubLabel: 'Move Trust Hub',
      },
      {
        step: 2,
        label: 'Renters or homeowners agent research',
        href: 'https://www.insurancetrusthub.com/directory',
        hubLabel: 'Insurance Trust Hub',
      },
    ],
  },
];

/** Trust Center — owned on Ask; hubs only deep-link here. */
export const TRUST_CENTER_LINKS = [
  {
    href: '/promise',
    label: 'Independence policy',
    detail: 'Zero paid placements · ranking not for sale',
  },
  {
    href: '/methodology',
    label: 'How we verify',
    detail: 'Verification process and Trust Score philosophy',
  },
  {
    href: '/data-sources',
    label: 'Data sources',
    detail: 'FMCSA, DOI/NAIC, NMLS, CFPB, and more',
  },
  {
    href: '/editorial-standards',
    label: 'Editorial standards',
    detail: 'Corrections, quality, and AI use',
  },
  {
    href: '/how-we-make-money',
    label: 'How we make money',
    detail: 'Transparent revenue · rankings not for sale',
  },
  {
    href: '/corrections',
    label: 'Report an error',
    detail: 'Corrections process for the network',
  },
] as const;

export const ASK_REVENUE_URL = 'https://www.asktrusthub.com/how-we-make-money';
export const ASK_PROMISE_URL = 'https://www.asktrusthub.com/promise';
export const ASK_METHODOLOGY_URL = 'https://www.asktrusthub.com/methodology';
