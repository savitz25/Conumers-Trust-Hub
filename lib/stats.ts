import { SISTER_SITES } from '@/lib/sites';

export const AGGREGATE_TRUST_STATS = [
  {
    value: '20,675+',
    label: 'Verified Providers',
    description: 'Across moving, lending & insurance directories',
  },
  {
    value: '2.8M+',
    label: 'Reviews Analyzed',
    description: 'Multi-source attribution — never paid placements',
  },
  {
    value: '3,142',
    label: 'Counties Covered',
    description: 'County-level lender insights nationwide',
  },
  {
    value: '50',
    label: 'States',
    description: 'Insurance agents & agencies with DOI checks',
  },
] as const;

export const VERIFICATION_SOURCES = [
  'FMCSA Licensing',
  'NMLS Verification',
  'State DOI Records',
  'CFPB Complaint Data',
  'BBB Ratings',
  'Attributed Reviews',
  'Zero Paid Placements',
] as const;

export const TESTIMONIALS = [
  {
    quote:
      'Having one place to research movers, lenders, and insurance before our cross-country move saved us weeks of scattered research.',
    author: 'Sarah M.',
    location: 'Denver, CO',
    vertical: 'moving' as const,
  },
  {
    quote:
      'The county-level lender data helped us compare NMLS-verified brokers side by side. No hidden sponsorships — just transparent numbers.',
    author: 'James T.',
    location: 'Miami-Dade, FL',
    vertical: 'lending' as const,
  },
  {
    quote:
      'We found a DOI-verified health insurance specialist through the hub and used the premium calculator to understand our options before enrolling.',
    author: 'Priya K.',
    location: 'Austin, TX',
    vertical: 'insurance' as const,
  },
  {
    quote:
      'Consumers Trust Hub connected the dots between our mortgage refinance and updated homeowners insurance — exactly what we needed.',
    author: 'Michael R.',
    location: 'Charlotte, NC',
    vertical: 'lending' as const,
  },
] as const;

export function getCombinedStats() {
  return Object.values(SISTER_SITES).flatMap((site) =>
    site.stats.map((stat) => ({
      ...stat,
      site: site.shortName,
      siteUrl: site.url,
    }))
  );
}