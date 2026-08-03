/**
 * Homepage situation router — discovery only.
 * Routes users to specialist hubs/tools. No directories on Ask.
 */

export type SituationRoute = {
  id: string;
  /** User-facing situation language */
  title: string;
  /** One-line why this route */
  detail: string;
  /** Hub prose name */
  hubLabel: string;
  /** Deep tool or hub home (absolute https) */
  href: string;
  /** Short CTA */
  cta: string;
  /** Compact hub tag for UI */
  hubTag: 'move' | 'insurance' | 'lender' | 'network';
};

export const SITUATION_PROMPT = 'What are you preparing for?' as const;

export const SITUATION_SUBCOPY =
  'Independent research · no paid placements · we route you to the right specialist hub' as const;

/**
 * Minimum four situations. Deep links verified against live specialist hosts.
 * Prefer tools when live; otherwise hub home.
 */
export const SITUATIONS: SituationRoute[] = [
  {
    id: 'moving-scam-risk',
    title: "I'm moving and don't want to get scammed",
    detail:
      'Research FMCSA-licensed movers and verify USDOT authority before you book.',
    hubLabel: 'Move Trust Hub',
    href: 'https://www.movetrusthub.com/verify-dot',
    cta: 'Verify a mover DOT number',
    hubTag: 'move',
  },
  {
    id: 'lender-legit',
    title: 'I need to know if this lender is legit',
    detail:
      'Cross-check NMLS licensing and public risk signals for mortgage lenders in your market.',
    hubLabel: 'Lender Trust Hub',
    href: 'https://www.lendertrusthub.com/local-lenders',
    cta: 'Research licensed lenders',
    hubTag: 'lender',
  },
  {
    id: 'health-coverage',
    title: 'My health coverage options are confusing',
    detail:
      'Use educational ACA tools and licensed-agent research — not a policy marketplace.',
    hubLabel: 'Insurance Trust Hub',
    href: 'https://www.insurancetrusthub.com/tools/cost-estimator',
    cta: 'Open cost & coverage planner',
    hubTag: 'insurance',
  },
  {
    id: 'medicare-research',
    title: "I'm turning 65 or reviewing Medicare",
    detail:
      'Situation-based paths to CMS tools, provider lookup, and agent research on Insurance Trust Hub.',
    hubLabel: 'Insurance Trust Hub',
    href: 'https://www.insurancetrusthub.com/tools/medicare-plan-finder',
    cta: 'Open Medicare research guide',
    hubTag: 'insurance',
  },
  {
    id: 'agent-verify',
    title: 'I want to verify an insurance agent license',
    detail: 'Start with state DOI / NAIC pathways and directory research before you enroll.',
    hubLabel: 'Insurance Trust Hub',
    href: 'https://www.insurancetrusthub.com/tools/license-verification',
    cta: 'License verification tools',
    hubTag: 'insurance',
  },
  {
    id: 'network-standards',
    title: 'I want the independence / methodology standard',
    detail:
      'Read how the network stays independent and how verification works across all hubs.',
    hubLabel: 'Ask Trust Hub',
    href: '/promise',
    cta: 'Independence policy',
    hubTag: 'network',
  },
];

/** Trust Center links owned on Ask (hubs only deep-link here). */
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
    detail: 'Transparent revenue model',
  },
  {
    href: '/corrections',
    label: 'Report an error',
    detail: 'Corrections process for the network',
  },
] as const;
