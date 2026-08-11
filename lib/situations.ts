/**
 * Homepage situation router — discovery only.
 * Routes users to specialist hubs/tools. No directories or PII on Ask.
 * Stage B.2: multi-hub checklists use generateTrustJourneyPlan deep links.
 */

import { generateTrustJourneyPlan } from '@/lib/orchestration/path-generator';

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
  'Common ownership · Separated research and listing order · No paid placements · We route you to the right specialist hub' as const;

/**
 * Lightweight keyword match for hero Concierge — no server, no PII.
 * Returns the best-matching situation or null.
 */
export function matchSituationFromQuery(raw: string): SituationRoute | null {
  const q = raw.trim().toLowerCase();
  if (!q || q.length < 2) return null;

  const rules: { id: string; keys: string[] }[] = [
    {
      id: 'buying-home',
      keys: ['buy home', 'buying a home', 'homebuyer', 'first home', 'purchase a house'],
    },
    {
      id: 'moving-scam-risk',
      keys: ['move', 'moving', 'mover', 'scam', 'dot', 'usdot', 'fmcsa', 'relocat'],
    },
    {
      id: 'relocating-work',
      keys: ['cross-country', 'interstate', 'job transfer', 'work reloc', 'long-distance'],
    },
    {
      id: 'lender-legit',
      keys: ['lender', 'mortgage', 'loan', 'nmls', 'refinance', 'refi', 'pre-approv'],
    },
    {
      id: 'premium-or-medicare',
      keys: ['insurance', 'medicare', 'premium', 'aca', 'health plan', 'turning 65', 'coverage'],
    },
  ];

  for (const rule of rules) {
    if (rule.keys.some((k) => q.includes(k))) {
      return SITUATIONS.find((s) => s.id === rule.id) ?? null;
    }
  }

  // Title / detail substring fallback
  const scored = SITUATIONS.map((s) => {
    const hay = `${s.title} ${s.detail} ${s.hubLabel}`.toLowerCase();
    let score = 0;
    for (const word of q.split(/\s+/).filter((w) => w.length > 2)) {
      if (hay.includes(word)) score += 1;
    }
    return { s, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.s ?? null;
}

/**
 * Situation cards (static links only — no forms, no PII, no directories on Ask).
 * Deep links verified against live specialist hosts (200 OK).
 * ≥4 cards above the fold on the homepage router.
 */
export const SITUATIONS: SituationRoute[] = [
  {
    id: 'moving-scam-risk',
    title: "I'm moving and don't want to get scammed",
    detail: 'Research FMCSA-licensed movers and verify USDOT authority before you book.',
    hubLabel: 'Move Trust Hub',
    href: 'https://www.movetrusthub.com/verify-dot',
    cta: 'Verify a DOT number',
    hubTag: 'move',
  },
  {
    id: 'lender-legit',
    title: 'I need to know if this lender is legit',
    detail:
      'Cross-check NMLS licensing and public risk signals for mortgage lenders in your market.',
    hubLabel: 'Lender Trust Hub',
    href: 'https://www.lendertrusthub.com/local-lenders',
    cta: 'Browse local lenders',
    hubTag: 'lender',
  },
  {
    id: 'premium-or-medicare',
    title: 'My premium jumped / I’m turning 65',
    detail:
      'Educational ACA and Medicare research on Insurance Trust Hub — not a policy marketplace.',
    hubLabel: 'Insurance Trust Hub',
    href: 'https://www.insurancetrusthub.com/tools/medicare-plan-finder',
    cta: 'Open Medicare research tools',
    hubTag: 'insurance',
  },
  {
    id: 'buying-home',
    title: "I'm buying a home",
    detail:
      'Ordered research path: financing first, then homeowners coverage — each on its specialist hub with journey context.',
    hubLabel: 'Multi-hub path',
    cta: 'Start with lenders',
    hubTag: 'multi',
    checklist: generateTrustJourneyPlan({ situationId: 'buy_local', state: 'FL' }).steps.map(
      (s) => ({
        step: s.step,
        label: s.title,
        href: s.href,
        hubLabel: s.hubLabel,
      })
    ),
  },
  {
    id: 'relocating-work',
    title: "I'm relocating for work / moving cross-country",
    detail:
      'Long-distance move research, financing if buying, then coverage — use What’s happening? for your destination.',
    hubLabel: 'Move + Lender + Insurance',
    cta: 'Start with movers',
    hubTag: 'multi',
    checklist: generateTrustJourneyPlan({
      situationId: 'move_buy',
      state: 'FL',
      county: 'miami-dade',
      citySlug: 'miami',
    }).steps.map((s) => ({
      step: s.step,
      label: s.title,
      href: s.href,
      hubLabel: s.hubLabel,
    })),
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
    label: 'The Ask Trust Hub Standard',
    detail: 'Network methodology · SOURCE → VERIFY → DISCLOSE → SCORE → UPDATE → YOU DECIDE',
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
