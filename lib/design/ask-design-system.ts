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
  'Independent research network — no paid placements, no lead fees.';

/** Homepage hero (Phase 2) — knowledge & concierge parent, not a product marketplace */
export const ASK_HERO_EYEBROW = 'ASK TRUST HUB  ·  KNOWLEDGE & CONCIERGE';

export const ASK_HERO_HEADLINE = 'Ask. Verify. Decide with confidence.';

/** Network philosophy — cite sources; consumer decides */
export const ASK_HERO_PHILOSOPHY = 'We cite. You decide.';

export const ASK_HERO_SUPPORT =
  'You are on the parent knowledge layer for the Trust Hub network. We help you understand verified public sources, then route you to Move Trust Hub, Lender Trust Hub, or Insurance Trust Hub for deep research. Not a marketplace. No paid placements. No lead fees.';

export const ASK_HERO_PRIMARY_CTA = {
  label: 'Get guided answers',
  href: '/#ask',
} as const;

export const ASK_HERO_SECONDARY_CTA = {
  label: 'Explore life journeys',
  href: '/#life-journeys',
} as const;

export const ASK_HERO_CHIPS = [
  'We cite. You decide.',
  'Independent research',
  'No paid placements',
  'Routes to specialist hubs',
] as const;

export const ASK_HERO_CONCIERGE_PLACEHOLDER =
  'What are you preparing for? e.g. moving, a mortgage, Medicare…';

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
  { href: '/#life-journeys', label: 'Life journeys' },
  { href: '/network', label: 'Network' },
  { href: '/methodology', label: 'Standard' },
  { href: '/trust', label: 'Trust Center' },
  { href: '/promise', label: 'Independence' },
] as const;

/** Primary header CTA — AI Concierge / situation entry */
export const ASK_HEADER_CONCIERGE = {
  label: 'AI Concierge',
  shortLabel: 'Ask',
  href: '/#ask',
  description: 'Describe your situation — we route you to the right hub',
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

export const ASK_FOOTER_COLUMNS = [
  {
    title: 'Explore',
    links: [
      { href: '/#ask', label: 'Ask a situation' },
      { href: '/#life-journeys', label: 'Life journeys' },
      { href: '/network', label: 'The Network' },
      { href: '/trust', label: 'Trust Center' },
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Standards',
    links: [
      { href: '/methodology', label: 'The Ask Trust Hub Standard' },
      { href: '/promise', label: 'Independence Policy' },
      { href: '/how-we-make-money', label: 'How We Make Money' },
      { href: '/data-sources', label: 'Data Sources' },
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
