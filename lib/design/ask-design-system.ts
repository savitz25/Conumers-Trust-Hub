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

/** Homepage hero (Phase 2 simplified) — Concierge is the primary product */
export const ASK_HERO_EYEBROW = 'ASK TRUST HUB  ·  KNOWLEDGE & CONCIERGE';

export const ASK_HERO_HEADLINE = 'Ask. Verify. Decide with confidence.';

/** Semantic descriptor under H1 */
export const ASK_HERO_DESCRIPTOR =
  'Independent consumer research for moving, insurance, and home lending.';

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
  label: 'Life journeys',
  href: '/journeys',
} as const;

export const ASK_HERO_CONCIERGE_PLACEHOLDER = 'What are you trying to figure out?';

export const ASK_HERO_CONCIERGE_MICRO =
  'No accounts. No personal data for routing. We match your situation and send you to the right specialist hub.';

/** Suggested situations under the Concierge input */
export const ASK_CONCIERGE_EXAMPLES = [
  { label: 'Moving', prompt: 'I am planning a move and need to research licensed movers.' },
  { label: 'Buying a home', prompt: 'I am buying a home and want to research NMLS-verified lenders.' },
  { label: 'Insurance', prompt: 'I need help researching licensed insurance options for coverage.' },
  { label: 'Medicare', prompt: 'I want educational research on Medicare coverage options.' },
  { label: 'Relocating', prompt: 'I am relocating and need help with movers and insurance.' },
  { label: 'Refinance', prompt: 'I am considering refinancing and want independent lender research.' },
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
] as const;

/**
 * Primary header nav (knowledge / concierge parent).
 * Switch Hub is a separate control, not a nav link.
 */
export const ASK_HEADER_NAV = [
  { href: '/#ask', label: 'Ask' },
  { href: '/journeys', label: 'Journeys' },
  { href: '/guides', label: 'Guides' },
  { href: '/network', label: 'Network' },
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
    body: 'Move, Lender, or Insurance Trust Hub - each owns deep research for its market.',
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
      { href: '/#trust-hubs', label: 'Specialist hubs' },
      { href: '/journeys', label: 'Life journeys' },
      { href: '/guides', label: 'Guides' },
      { href: '/network', label: 'The Network' },
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
