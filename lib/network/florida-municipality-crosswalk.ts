/**
 * Deliberately bounded crosswalk for published AskTrustHub consumer journeys.
 * County assignments follow the Florida Department of State municipality list
 * and are checked in so research planning never depends on runtime geocoding.
 * `coverage` is intentionally PARTIAL: an absent municipality must fail closed.
 */
export const FLORIDA_MUNICIPALITY_CROSSWALK = {
  'fort lauderdale': {city:'Fort Lauderdale',county:'Broward'},
  'ft lauderdale': {city:'Fort Lauderdale',county:'Broward'},
  'ft. lauderdale': {city:'Fort Lauderdale',county:'Broward'},
  'deerfield beach': {city:'Deerfield Beach',county:'Broward'},
  'pompano beach': {city:'Pompano Beach',county:'Broward'},
  hollywood: {city:'Hollywood',county:'Broward'},
  'pembroke pines': {city:'Pembroke Pines',county:'Broward'},
  'coral springs': {city:'Coral Springs',county:'Broward'},
  'boca raton': {city:'Boca Raton',county:'Palm Beach'},
  boca: {city:'Boca Raton',county:'Palm Beach'},
  'west palm beach': {city:'West Palm Beach',county:'Palm Beach'},
  'west palm': {city:'West Palm Beach',county:'Palm Beach'},
  'delray beach': {city:'Delray Beach',county:'Palm Beach'},
  'boynton beach': {city:'Boynton Beach',county:'Palm Beach'},
  jupiter: {city:'Jupiter',county:'Palm Beach'},
  wellington: {city:'Wellington',county:'Palm Beach'},
  tampa: {city:'Tampa',county:'Hillsborough'},
  'st petersburg': {city:'St. Petersburg',county:'Pinellas'},
  'st. petersburg': {city:'St. Petersburg',county:'Pinellas'},
  'saint petersburg': {city:'Saint Petersburg',county:'Pinellas'},
  clearwater: {city:'Clearwater',county:'Pinellas'},
  miami: {city:'Miami',county:'Miami-Dade'},
  'miami beach': {city:'Miami Beach',county:'Miami-Dade'},
  hialeah: {city:'Hialeah',county:'Miami-Dade'},
  orlando: {city:'Orlando',county:'Orange'},
} as const;

export const FLORIDA_CROSSWALK_METADATA = {
  coverage:'PARTIAL',
  source:'Florida Department of State, Division of Library and Information Services city/county list',
  sourceUrl:'https://dos.fl.gov/library-archives/research/florida-information/government/local-resources/citycounty-list/counties/',
  purpose:'Published AskTrustHub local consumer journeys',
} as const;

export function resolveFloridaMunicipality(value:string){
  const key=value.toLowerCase().replace(/[,]+/g,' ').replace(/\s+/g,' ').trim();
  return FLORIDA_MUNICIPALITY_CROSSWALK[key as keyof typeof FLORIDA_MUNICIPALITY_CROSSWALK];
}

/**
 * TH-DISCOVERY-RESET-001: standard US Census county FIPS codes for all 67 Florida counties
 * (state FIPS 12) -- checked in as static reference data, same rationale as the municipality
 * crosswalk above. LenderTrustHub's own HMDA specialist has real county-grain data for every one
 * of these (spot-verified live, including small counties like Hendry), but specialists.ts's
 * request builder previously only knew the FIPS code for Broward/Palm Beach, so every other real,
 * data-backed county silently fell back to a state-level broadening instead of the precise county
 * result RESULTS FIRST calls for.
 */
export const FL_COUNTY_FIPS: Record<string, string> = {
  alachua: '12001', baker: '12003', bay: '12005', bradford: '12007', brevard: '12009',
  broward: '12011', calhoun: '12013', charlotte: '12015', citrus: '12017', clay: '12019',
  collier: '12021', columbia: '12023', desoto: '12027', dixie: '12029', duval: '12031',
  escambia: '12033', flagler: '12035', franklin: '12037', gadsden: '12039', gilchrist: '12041',
  glades: '12043', gulf: '12045', hamilton: '12047', hardee: '12049', hendry: '12051',
  hernando: '12053', highlands: '12055', hillsborough: '12057', holmes: '12059',
  'indian river': '12061', jackson: '12063', jefferson: '12065', lafayette: '12067',
  lake: '12069', lee: '12071', leon: '12073', levy: '12075', liberty: '12077',
  madison: '12079', manatee: '12081', marion: '12083', martin: '12085',
  'miami-dade': '12086', 'miami dade': '12086', monroe: '12087', nassau: '12089',
  okaloosa: '12091', okeechobee: '12093', orange: '12095', osceola: '12097',
  'palm beach': '12099', pasco: '12101', pinellas: '12103', polk: '12105', putnam: '12107',
  'st. johns': '12109', 'st johns': '12109', 'saint johns': '12109',
  'st. lucie': '12111', 'st lucie': '12111', 'saint lucie': '12111',
  'santa rosa': '12113', sarasota: '12115', seminole: '12117', sumter: '12119',
  suwannee: '12121', taylor: '12123', union: '12125', volusia: '12127', wakulla: '12129',
  walton: '12131', washington: '12133',
};
export function resolveFlCountyFips(county: string | undefined): string | undefined {
  if (!county) return undefined;
  return FL_COUNTY_FIPS[county.toLowerCase().trim()];
}

// TH-DISCOVERY-003: free-text detector reused by lib/network/ask-parse.ts so every hub's shared
// geography parser recognizes every crosswalk municipality (not just a hardcoded 3-city allowlist
// of Tampa/Miami/Boca Raton). Longest keys are checked first so a multi-word city is never
// short-circuited by a shorter alias substring.
const CROSSWALK_KEYS = Object.keys(FLORIDA_MUNICIPALITY_CROSSWALK).sort((a, b) => b.length - a.length);
// TH-DISCOVERY-RESET-001 (Vercel review fix): a crosswalk key like "hollywood" must not match
// inside a real, distinct compound place name -- "West Hollywood" (a real, different city, e.g.
// in California) is not "Hollywood, Florida". Reject a match immediately preceded by a compass
// direction or a qualifier word that would change which place is actually being named.
const NOT_PRECEDED_BY_QUALIFIER = '(?<!\\b(?:west|north|south|east)\\s)';
export function detectFloridaCity(q: string): { city: string; county: string } | undefined {
  for (const key of CROSSWALK_KEYS) {
    const pattern = new RegExp(
      `${NOT_PRECEDED_BY_QUALIFIER}\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`,
      'i',
    );
    if (pattern.test(q)) return FLORIDA_MUNICIPALITY_CROSSWALK[key as keyof typeof FLORIDA_MUNICIPALITY_CROSSWALK];
  }
  return undefined;
}
