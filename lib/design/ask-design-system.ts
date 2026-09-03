/**
 * Ask Trust Hub — Master Design System (Phase 1).
 * Parent / knowledge / concierge layer for the Trust Hub network.
 *
 * CSS variables live on [data-hub="ask"] and :root in app/globals.css.
 * Do not invent alternate indigo/navy values in components — import from here.
 */

export const ASK_BRAND = {
  /** Insight Indigo — primary CTAs, active nav, focus */
  indigo: '#4F46E5',
  /** Soft Purple — hover / deeper emphasis */
  purple: '#6B21A8',
  /** Soft Periwinkle — soft surfaces, tags, selected */
  periwinkle: '#E0E7FF',
  /** Deep Navy — primary text, footer, dark surfaces */
  navy: '#0A2540',
  /** High-contrast body copy */
  ink: '#1E293B',
  /** Soft off-white page canvas */
  canvas: '#F8FAFC',
  white: '#FFFFFF',
  /** Borders / subtle lines */
  border: '#E2E8F0',
  /** Footer / muted on navy (still readable) */
  onNavyMuted: '#94A3B8',
  onNavySoft: '#CBD5E1',
} as const;

export const ASK_RADIUS = {
  /** Cards, panels */
  card: '0.75rem', // 12px
  cardLg: '1rem', // 16px
  /** Pills, chips */
  pill: '9999px',
  /** Controls */
  control: '0.5rem',
} as const;

export const ASK_SHADOW = {
  soft: '0 1px 2px rgb(10 37 64 / 0.04), 0 4px 16px rgb(10 37 64 / 0.05)',
  card: '0 1px 2px rgb(10 37 64 / 0.05), 0 8px 24px rgb(10 37 64 / 0.07)',
  indigo: '0 6px 20px -6px rgb(79 70 229 / 0.35)',
} as const;

export const ASK_SPACE = {
  /** 8px base */
  unit: 8,
} as const;

export const ASK_TAGLINE = 'SOURCES. VERIFIED. YOU DECIDE.';

export const ASK_INDEPENDENCE_LINE =
  'Independent research — no paid placements, no lead fees. Common ownership · Separated research and listing order.';

/** Homepage hero — network command center (Prompt 1) */
export const ASK_HERO_EYEBROW = 'THE TRUST HUB NETWORK';

export const ASK_HERO_HEADLINE = 'Ask the TrustHub Network.';

/** Semantic descriptor under H1 */
export const ASK_HERO_DESCRIPTOR =
  'Independent consumer research across one network with specialist domains.';

/** Network philosophy — cite sources; consumer decides */
export const ASK_HERO_PHILOSOPHY = 'We cite. You decide.';

/** One clean parent-role line (do not restate below the fold) */
export const ASK_HERO_SUPPORT =
  'The parent knowledge layer of the Trust Hub network: we clarify verified public sources, then route you to the right specialist hub for deep research.';

export const ASK_HERO_PRIMARY_CTA = {
  label: 'Ask the Concierge',
  href: '/#ask',
} as const;

export const ASK_HERO_SECONDARY_CTA = {
  label: "What's happening?",
  href: '/#whats-happening',
} as const;

export const ASK_HERO_CONCIERGE_PLACEHOLDER = 'What are you trying to figure out?';

export const ASK_HERO_CONCIERGE_MICRO =
  'No accounts. No personal data for routing. Prefer the path planner below for an ordered multi-hub research plan — or open the Concierge for a free-form question.';

/** Suggested situations under the Concierge input */
export const ASK_CONCIERGE_EXAMPLES = [
  { label: 'Moving + buying', prompt: 'I am moving to another state and plan to buy a home.' },
  { label: 'Moving + renting', prompt: 'I am relocating and plan to rent at the destination.' },
  { label: 'Buying locally', prompt: 'I am buying a home and want NMLS-oriented lender research.' },
  { label: 'Refinance', prompt: 'I am considering refinancing and want independent lender research.' },
  { label: 'Coverage after move', prompt: 'I need insurance research after moving to a new state.' },
  { label: 'Movers only', prompt: 'I need to research FMCSA-licensed movers for a move.' },
  { label: 'Hiring a contractor', prompt: 'I need to research a contractor license before hiring.' },
  { label: 'Aging parent', prompt: 'I am researching senior care for an aging parent.' },
  { label: 'Investment firm', prompt: 'I want to research an investment firm using SEC filings.' },
] as const;

/** Homepage specialist hub cards */
export const ASK_HOME_HUBS = [
  {
    id: 'move' as const,
    name: 'Move Trust Hub',
    blurb: 'FMCSA-licensed movers, Verify DOT, and free Move Plan tools.',
    href: 'https://www.movetrusthub.com',
    cta: 'Research movers',
    accent: '#FF5A1F',
    soft: '#FFF4EF',
  },
  {
    id: 'lender' as const,
    name: 'Lender Trust Hub',
    blurb: 'NMLS-oriented lender research, comparisons, and educational calculators.',
    href: 'https://www.lendertrusthub.com',
    cta: 'Research lenders',
    accent: '#0D9488',
    soft: '#F0FDFA',
  },
  {
    id: 'insurance' as const,
    name: 'Insurance Trust Hub',
    blurb: 'DOI / license context, coverage research, and educational tools.',
    href: 'https://www.insurancetrusthub.com',
    cta: 'Research coverage',
    accent: '#0284C7',
    soft: '#E0F2FE',
  },
  {
    id: 'contractor' as const,
    name: 'Contractor Trust Hub',
    blurb: 'Multi-state contractor license research with state-specific evidence depth.',
    href: 'https://www.contractortrusthub.com',
    cta: 'Research contractors',
    accent: '#0A2540',
    soft: '#EEF2FF',
  },
  {
    id: 'senior' as const,
    name: 'SeniorTrustHub',
    blurb: 'Government-sourced senior care research using CMS and supported state evidence.',
    href: 'https://www.seniortrusthub.com',
    cta: 'Research senior care',
    accent: '#7C3AED',
    soft: '#F5F3FF',
  },
  {
    id: 'investor' as const,
    name: 'InvestorTrustHub',
    blurb: 'Investment firm research using SEC/IARD evidence. Research before you invest.',
    href: 'https://www.investortrusthub.com',
    cta: 'Research firms',
    accent: '#001F52',
    soft: '#EEF4FF',
  },
] as const;

/** Short trust signals (homepage strip) — high-confidence, no essay */
export const ASK_HOME_TRUST_SIGNALS = [
  'No paid placements',
  'No lead fees',
  'Primary-source verification',
  'Transparent methodology',
] as const;

/** Parent → child hubs (hero network strip) */
export const ASK_HERO_NETWORK_PILLS = [
  { id: 'move', label: 'Move', href: 'https://www.movetrusthub.com' },
  { id: 'lender', label: 'Lender', href: 'https://www.lendertrusthub.com' },
  { id: 'insurance', label: 'Insurance', href: 'https://www.insurancetrusthub.com' },
  { id: 'contractor', label: 'Contractor', href: 'https://www.contractortrusthub.com' },
  { id: 'senior', label: 'Senior', href: 'https://www.seniortrusthub.com' },
  { id: 'investor', label: 'Investor', href: 'https://www.investortrusthub.com' },
] as const;

/**
 * Primary header nav (knowledge / concierge parent).
 * Switch Hub is a separate control, not a nav link.
 */
export const ASK_HEADER_NAV = [
  { href: '/ask', label: 'Ask' },
  { href: '/#whats-happening', label: 'Path' },
  { href: '/my-trust-journey', label: 'My Journey' },
  { href: '/journeys', label: 'Journeys' },
  { href: '/guides', label: 'Guides' },
  { href: '/network', label: 'Network' },
  { href: '/network/coverage', label: 'Coverage' },
  { href: '/methodology', label: 'Standard' },
  { href: '/trust', label: 'Trust' },
] as const;

/** Primary header CTA — opens xAI Concierge chat */
export const ASK_HEADER_CONCIERGE = {
  label: 'AI Concierge',
  shortLabel: 'Ask AI',
  href: '/#ask',
  description: 'Open the Ask Trust Hub Concierge — independent guidance powered by xAI',
} as const;

/** Specialist hubs for Switch Hub + footer network */
export const ASK_NETWORK_LINKS = [
  {
    id: 'move' as const,
    label: 'Move Trust Hub',
    shortLabel: 'Move',
    href: 'https://www.movetrusthub.com',
    blurb: 'FMCSA movers & local guides',
  },
  {
    id: 'lender' as const,
    label: 'Lender Trust Hub',
    shortLabel: 'Lender',
    href: 'https://www.lendertrusthub.com',
    blurb: 'NMLS-verified lenders',
  },
  {
    id: 'insurance' as const,
    label: 'Insurance Trust Hub',
    shortLabel: 'Insurance',
    href: 'https://www.insurancetrusthub.com',
    blurb: 'Licensed agencies & plans',
  },
  {
    id: 'contractor' as const,
    label: 'Contractor Trust Hub',
    shortLabel: 'Contractor',
    href: 'https://www.contractortrusthub.com',
    blurb: 'State licensing-board research',
  },
  {
    id: 'senior' as const,
    label: 'SeniorTrustHub',
    shortLabel: 'Senior',
    href: 'https://www.seniortrusthub.com',
    blurb: 'CMS / supported state senior-care research',
  },
  {
    id: 'investor' as const,
    label: 'InvestorTrustHub',
    shortLabel: 'Investor',
    href: 'https://www.investortrusthub.com',
    blurb: 'SEC / IARD investment-firm research',
  },
] as const;

/** Phase 3 — How the network works (4 steps) */
export const ASK_NETWORK_STEPS = [
  {
    step: 1,
    title: 'Start with guidance on Ask',
    body: 'Get verified context and a clear research path - not a sales pitch or lead form.',
  },
  {
    step: 2,
    title: 'Route to the right specialist hub',
    body: 'Each specialist hub owns deep research for its market — Ask routes; it does not host directories.',
  },
  {
    step: 3,
    title: 'Do deep research on the hub',
    body: 'Directories, tools, and public-source checks live on the specialist sites - not on Ask.',
  },
  {
    step: 4,
    title: 'You decide',
    body: 'We cite sources. We do not sell placements or rank for pay. You choose what to do next.',
  },
] as const;

/** Phase 3 — Trust & standards pillars */
export const ASK_TRUST_PILLARS = [
  {
    title: 'Independent research',
    body: 'Common ownership with separated research and listing rules across the network.',
  },
  {
    title: 'Verified public sources',
    body: 'FMCSA, NMLS, state DOI/NAIC pathways, and other primary registries - attributed and checkable.',
  },
  {
    title: 'No paid placements',
    body: 'Ranking position is not for sale. No lead fees for organic research ordering.',
  },
  {
    title: 'Guidance vs directories',
    body: 'Ask routes and explains. Specialist hubs host directories and tools. We cite. You decide.',
  },
] as const;

export const ASK_FOOTER_COLUMNS = [
  {
    title: 'Explore',
    links: [
      { href: '/#ask', label: 'Ask Concierge' },
      { href: '/#whats-happening', label: "What's happening?" },
      { href: '/my-trust-journey', label: 'My Trust Journey' },
      { href: '/#trust-hubs', label: 'Specialist hubs' },
      { href: '/journeys', label: 'Life journeys' },
      { href: '/guides', label: 'Guides' },
      { href: '/network', label: 'The Network' },
      { href: '/new-jersey', label: 'New Jersey research' },
      { href: '/california', label: 'California research' },
      { href: '/trust', label: 'Trust Center' },
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Standards',
    links: [
      { href: '/methodology', label: 'The Standard' },
      { href: '/data-sources', label: 'Data Sources' },
      { href: '/promise', label: 'Independence Policy' },
      { href: '/how-we-make-money', label: 'How We Make Money' },
      { href: '/editorial-standards', label: 'Editorial Standards' },
      { href: '/corrections', label: 'Corrections' },
      { href: '/academic', label: 'Academic Research' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
      { href: '/who-we-are', label: 'Who We Are' },
    ],
  },
] as const;
