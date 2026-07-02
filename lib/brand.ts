/** Master brand — consumertrusthub.com (no 's') */
export const BRAND = {
  name: 'ConsumerTrust Hub',
  shortName: 'CTH',
  domain: 'consumertrusthub.com',
  url: 'https://www.consumertrusthub.com',
  tagline: 'One trusted home for your entire move.',
  coachTagline: "Let's make this move the best one yet!",
  email: 'hello@consumertrusthub.com',
} as const;

/** Legacy domains — 308 redirect sources (not yet active) */
export const LEGACY_DOMAINS = {
  moving: { host: 'movetrusthub.com', brand: 'MoveTrust Hub', emoji: '✨' },
  lending: { host: 'lendertrusthub.com', brand: 'LenderTrust Hub', emoji: '✨' },
  insurance: { host: 'insurancetrusthub.com', brand: 'InsuranceTrust Hub', emoji: '✨' },
} as const;

export type LegacySource = keyof typeof LEGACY_DOMAINS;