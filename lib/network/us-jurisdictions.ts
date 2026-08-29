/** 50 states + DC. Territories are not added just to fill the matrix. */

export type UsJurisdiction = {
  code: string;
  name: string;
  slug: string;
  kind: 'state' | 'district';
};

export const US_JURISDICTIONS: UsJurisdiction[] = [
  { code: 'AL', name: 'Alabama', slug: 'alabama', kind: 'state' },
  { code: 'AK', name: 'Alaska', slug: 'alaska', kind: 'state' },
  { code: 'AZ', name: 'Arizona', slug: 'arizona', kind: 'state' },
  { code: 'AR', name: 'Arkansas', slug: 'arkansas', kind: 'state' },
  { code: 'CA', name: 'California', slug: 'california', kind: 'state' },
  { code: 'CO', name: 'Colorado', slug: 'colorado', kind: 'state' },
  { code: 'CT', name: 'Connecticut', slug: 'connecticut', kind: 'state' },
  { code: 'DE', name: 'Delaware', slug: 'delaware', kind: 'state' },
  { code: 'DC', name: 'District of Columbia', slug: 'district-of-columbia', kind: 'district' },
  { code: 'FL', name: 'Florida', slug: 'florida', kind: 'state' },
  { code: 'GA', name: 'Georgia', slug: 'georgia', kind: 'state' },
  { code: 'HI', name: 'Hawaii', slug: 'hawaii', kind: 'state' },
  { code: 'ID', name: 'Idaho', slug: 'idaho', kind: 'state' },
  { code: 'IL', name: 'Illinois', slug: 'illinois', kind: 'state' },
  { code: 'IN', name: 'Indiana', slug: 'indiana', kind: 'state' },
  { code: 'IA', name: 'Iowa', slug: 'iowa', kind: 'state' },
  { code: 'KS', name: 'Kansas', slug: 'kansas', kind: 'state' },
  { code: 'KY', name: 'Kentucky', slug: 'kentucky', kind: 'state' },
  { code: 'LA', name: 'Louisiana', slug: 'louisiana', kind: 'state' },
  { code: 'ME', name: 'Maine', slug: 'maine', kind: 'state' },
  { code: 'MD', name: 'Maryland', slug: 'maryland', kind: 'state' },
  { code: 'MA', name: 'Massachusetts', slug: 'massachusetts', kind: 'state' },
  { code: 'MI', name: 'Michigan', slug: 'michigan', kind: 'state' },
  { code: 'MN', name: 'Minnesota', slug: 'minnesota', kind: 'state' },
  { code: 'MS', name: 'Mississippi', slug: 'mississippi', kind: 'state' },
  { code: 'MO', name: 'Missouri', slug: 'missouri', kind: 'state' },
  { code: 'MT', name: 'Montana', slug: 'montana', kind: 'state' },
  { code: 'NE', name: 'Nebraska', slug: 'nebraska', kind: 'state' },
  { code: 'NV', name: 'Nevada', slug: 'nevada', kind: 'state' },
  { code: 'NH', name: 'New Hampshire', slug: 'new-hampshire', kind: 'state' },
  { code: 'NJ', name: 'New Jersey', slug: 'new-jersey', kind: 'state' },
  { code: 'NM', name: 'New Mexico', slug: 'new-mexico', kind: 'state' },
  { code: 'NY', name: 'New York', slug: 'new-york', kind: 'state' },
  { code: 'NC', name: 'North Carolina', slug: 'north-carolina', kind: 'state' },
  { code: 'ND', name: 'North Dakota', slug: 'north-dakota', kind: 'state' },
  { code: 'OH', name: 'Ohio', slug: 'ohio', kind: 'state' },
  { code: 'OK', name: 'Oklahoma', slug: 'oklahoma', kind: 'state' },
  { code: 'OR', name: 'Oregon', slug: 'oregon', kind: 'state' },
  { code: 'PA', name: 'Pennsylvania', slug: 'pennsylvania', kind: 'state' },
  { code: 'RI', name: 'Rhode Island', slug: 'rhode-island', kind: 'state' },
  { code: 'SC', name: 'South Carolina', slug: 'south-carolina', kind: 'state' },
  { code: 'SD', name: 'South Dakota', slug: 'south-dakota', kind: 'state' },
  { code: 'TN', name: 'Tennessee', slug: 'tennessee', kind: 'state' },
  { code: 'TX', name: 'Texas', slug: 'texas', kind: 'state' },
  { code: 'UT', name: 'Utah', slug: 'utah', kind: 'state' },
  { code: 'VT', name: 'Vermont', slug: 'vermont', kind: 'state' },
  { code: 'VA', name: 'Virginia', slug: 'virginia', kind: 'state' },
  { code: 'WA', name: 'Washington', slug: 'washington', kind: 'state' },
  { code: 'WV', name: 'West Virginia', slug: 'west-virginia', kind: 'state' },
  { code: 'WI', name: 'Wisconsin', slug: 'wisconsin', kind: 'state' },
  { code: 'WY', name: 'Wyoming', slug: 'wyoming', kind: 'state' },
];

export function jurisdictionByCode(code: string): UsJurisdiction | undefined {
  return US_JURISDICTIONS.find((j) => j.code === code.toUpperCase());
}

export function jurisdictionBySlug(slug: string): UsJurisdiction | undefined {
  return US_JURISDICTIONS.find((j) => j.slug === slug.toLowerCase());
}
