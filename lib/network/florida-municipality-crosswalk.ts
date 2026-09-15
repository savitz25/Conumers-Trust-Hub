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

// TH-DISCOVERY-003: free-text detector reused by lib/network/ask-parse.ts so every hub's shared
// geography parser recognizes every crosswalk municipality (not just a hardcoded 3-city allowlist
// of Tampa/Miami/Boca Raton). Longest keys are checked first so a multi-word city is never
// short-circuited by a shorter alias substring.
const CROSSWALK_KEYS = Object.keys(FLORIDA_MUNICIPALITY_CROSSWALK).sort((a, b) => b.length - a.length);
export function detectFloridaCity(q: string): { city: string; county: string } | undefined {
  for (const key of CROSSWALK_KEYS) {
    const pattern = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (pattern.test(q)) return FLORIDA_MUNICIPALITY_CROSSWALK[key as keyof typeof FLORIDA_MUNICIPALITY_CROSSWALK];
  }
  return undefined;
}
