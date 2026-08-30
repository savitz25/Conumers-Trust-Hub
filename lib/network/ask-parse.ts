import { IDENTIFIER_FAMILIES, collidingBareDigitsNote, type IdentifierFamily } from './identifiers.ts';
import type { SpecialistHubId } from './registry.ts';
import { detectSeniorProviderClass, isSeniorClassQuery, type SeniorProviderClass } from './senior-ask.ts';
import { detectInvestorFirmType, isInvestorClassQuery, type InvestorFirmType } from './investor-ask.ts';
import {
  detectInsuranceEntityClass,
  insuranceGeographyMeaning,
  isInsuranceClassQuery,
  type InsuranceEntityClass,
} from './insurance-ask.ts';

export type NetworkAskIntent =
  | 'entity'
  | 'identifier'
  | 'market'
  | 'comparison'
  | 'place'
  | 'journey'
  | 'definition'
  | 'name_check';

export type ParsedGeography = {
  stateCode?: 'FL';
  stateName?: 'Florida';
  countySlug?: 'broward' | 'palm-beach';
  countyName?: string;
  meaning: string;
};

export type ParsedIdentifier = {
  family: IdentifierFamily;
  raw: string;
  ambiguous: boolean;
  note: string;
};

export type ParsedNetworkAsk = {
  query: string;
  intent: NetworkAskIntent;
  geography?: ParsedGeography;
  trade?: string;
  credentialStatus?: string;
  identifier?: ParsedIdentifier;
  nameQuery?: string;
  suggestedHubs: SpecialistHubId[];
  topic: string;
  interpretationLines: Array<{ label: string; value: string }>;
  seniorProviderClass?: SeniorProviderClass;
  investorFirmType?: InvestorFirmType;
  insuranceEntityClass?: InsuranceEntityClass;
};

const FL = /\bflorida\b|\bfl\b/i;
const BROWARD = /\bbroward\b/i;
const PALM = /\bpalm\s*beach\b/i;

function geography(q: string): ParsedGeography | undefined {
  const broward = BROWARD.test(q);
  const palm = PALM.test(q);
  const florida = FL.test(q) || broward || palm;
  if (broward) {
    return {
      stateCode: 'FL',
      stateName: 'Florida',
      countySlug: 'broward',
      countyName: 'Broward County',
      meaning: 'Broward County, Florida. County meaning differs by hub (mailing county ≠ service territory; HMDA property county ≠ HQ).',
    };
  }
  if (palm) {
    return {
      stateCode: 'FL',
      stateName: 'Florida',
      countySlug: 'palm-beach',
      countyName: 'Palm Beach County',
      meaning: 'Palm Beach County, Florida. County meaning differs by hub.',
    };
  }
  if (florida) {
    return {
      stateCode: 'FL',
      stateName: 'Florida',
      meaning: 'Florida. State licensing is not physical location; principal office is not client geography.',
    };
  }
  return undefined;
}

function matchIdentifier(q: string): ParsedIdentifier | undefined {
  const trimmed = q.trim();
  const ccnInSentence = trimmed.match(/\b(?:cms\s+)?ccn\s*#?\s*(\d{6})\b/i);
  if (ccnInSentence) {
    const family = IDENTIFIER_FAMILIES.find((f) => f.id === 'cms_ccn');
    if (family) {
      return { family, raw: `CCN ${ccnInSentence[1]}`, ambiguous: false, note: family.note };
    }
  }
  const crdInSentence = trimmed.match(/\bcrd\s*#?\s*(\d{4,10})\b/i);
  if (crdInSentence) {
    const family = IDENTIFIER_FAMILIES.find((f) => f.id === 'crd');
    if (family) {
      return { family, raw: `CRD ${crdInSentence[1]}`, ambiguous: false, note: family.note };
    }
  }
  const npnInSentence = trimmed.match(/\bnpn\s*#?\s*(\d{4,12})\b/i);
  if (npnInSentence) {
    const family = IDENTIFIER_FAMILIES.find((f) => f.id === 'npn');
    if (family) {
      return { family, raw: `NPN ${npnInSentence[1]}`, ambiguous: false, note: family.note };
    }
  }
  const naicInSentence = trimmed.match(/\bnaic(?:\s+company)?(?:\s+code)?\s*#?\s*(\d{3,6})\b/i);
  if (naicInSentence) {
    const family = IDENTIFIER_FAMILIES.find((f) => f.id === 'naic_company_code');
    if (family) {
      return { family, raw: `NAIC ${naicInSentence[1]}`, ambiguous: false, note: family.note };
    }
  }
  const labeled = IDENTIFIER_FAMILIES.find((f) => f.pattern.test(trimmed) && /^(?:dot|usdot|mc|nmls|npn|ccn|crd|cbc|cgc|ccc|crc|cac|cfc)\b/i.test(trimmed));
  if (labeled) {
    const ambiguous = false;
    return { family: labeled, raw: trimmed, ambiguous, note: labeled.note };
  }
  const bare = IDENTIFIER_FAMILIES.filter((f) => f.pattern.test(trimmed));
  if (bare.length === 1 && /^(?:dot|usdot|mc|nmls|npn|ccn|crd)/i.test(trimmed)) {
    return { family: bare[0], raw: trimmed, ambiguous: false, note: bare[0].note };
  }
  if (/^\d{5,12}$/.test(trimmed)) {
    return {
      family: IDENTIFIER_FAMILIES[0],
      raw: trimmed,
      ambiguous: true,
      note: collidingBareDigitsNote(),
    };
  }
  const flLicense = IDENTIFIER_FAMILIES.find((f) => f.id === 'state_contractor_license');
  if (flLicense && flLicense.pattern.test(trimmed)) {
    return { family: flLicense, raw: trimmed, ambiguous: false, note: flLicense.note };
  }
  for (const f of IDENTIFIER_FAMILIES) {
    if (f.pattern.test(trimmed) && f.id !== 'usdot' && f.id !== 'mc' && f.id !== 'cms_ccn') {
      return { family: f, raw: trimmed, ambiguous: false, note: f.note };
    }
  }
  return undefined;
}

export function parseNetworkAsk(raw: string): ParsedNetworkAsk {
  const query = raw.trim();
  const geo = geography(query);
  const id = matchIdentifier(query);

  const nameCheck =
    /across (the )?trusthub|check (a |this )?name|name check|appears in more than one/i.test(query) ||
    (/^(search|find|look up)\s+.+holdings/i.test(query) && /across|network|trusthub/i.test(query));

  const buying = /buy(ing)? (a )?(home|house)|home purchase|first[- ]time (home)?buyer/i.test(query);
  const moving = /mov(e|ing) to|relocating|interstate move/i.test(query);
  const seniorCare = isSeniorClassQuery(query);
  const seniorProviderClass = detectSeniorProviderClass(query);
  const comparePlaces = /compare .*(broward|palm beach)|broward.*palm beach|palm beach.*broward/i.test(query);
  const placeQ = /what (do you|does trusthub) know about|research in broward|about broward|about palm beach|about florida/i.test(query);
  const contractor = /contractor|roof(ing|er)|hvac|plumb|electrical|general contractor|dbpr|cilb/i.test(query);
  const lender = /lender|mortgage|hmda|fha|nmls|loan officer/i.test(query);
  const insurance = isInsuranceClassQuery(query) || /insur(ance|er)|doi|producer|agency license|\bnpn\b|\bnaic\b/i.test(query);
  const insuranceEntityClass = detectInsuranceEntityClass(query);
  const investor = isInvestorClassQuery(query) || /adviser|advisor|form adv|iard|crd|ria\b|era\b|investment firm/i.test(query);
  const investorFirmType = detectInvestorFirmType(query);
  const mover = /mover|usdot|fmcsa|moving compan/i.test(query);
  const roofing = /roof/i.test(query);
  const fha = /\bfha\b/i.test(query);

  let intent: NetworkAskIntent = 'definition';
  const hubs: SpecialistHubId[] = [];
  let topic = 'Network research routing';
  let trade: string | undefined;
  let credentialStatus: string | undefined;
  let nameQuery: string | undefined;

  if (id && !id.ambiguous) {
    intent = 'identifier';
    hubs.push(id.family.hubId);
    topic = `${id.family.label} identifier`;
  } else if (id?.ambiguous) {
    intent = 'identifier';
    topic = 'Ambiguous identifier';
  } else if (nameCheck) {
    intent = 'name_check';
    nameQuery = query.replace(/^(search|find|look up|check)\s+/i, '').replace(/\s+across.*$/i, '').trim();
    topic = 'Cross-hub name check';
  } else if (comparePlaces) {
    intent = 'comparison';
    hubs.push('contractor', 'lender', 'insurance', 'move');
    topic = 'Compare Broward and Palm Beach';
  } else if (placeQ || ((BROWARD.test(query) || PALM.test(query)) && /what|know|research/i.test(query) && !contractor && !buying)) {
    intent = 'place';
    hubs.push('contractor', 'lender', 'insurance', 'move', 'senior', 'investor');
    topic = geo?.countyName ? `${geo.countyName} Place Lens` : 'Florida Place Lens';
  } else if (buying) {
    intent = 'journey';
    hubs.push('lender', 'insurance', 'contractor', 'move');
    topic = 'Buying a home';
  } else if (moving && !mover) {
    intent = 'journey';
    hubs.push('move', 'insurance', 'lender');
    topic = 'Moving / relocating';
  } else if (seniorCare) {
    intent = 'entity';
    hubs.push('senior');
    topic = seniorProviderClass
      ? `${seniorProviderClass === 'nursing_home' ? 'Nursing Home' : seniorProviderClass === 'home_health' ? 'Home Health' : 'Hospice'} research`
      : 'Senior-care research';
  } else if (contractor) {
    intent = 'entity';
    hubs.push('contractor');
    topic = 'Contractor licensing research';
    if (roofing) trade = 'Roofing';
    if (/active|current/i.test(query)) credentialStatus = 'Active/current';
  } else if (fha || (lender && !buying)) {
    intent = 'market';
    hubs.push('lender');
    topic = fha ? 'FHA / mortgage-market research' : 'Lending research';
  } else if (insurance) {
    intent = 'entity';
    hubs.push('insurance');
    topic =
      insuranceEntityClass === 'person'
        ? 'Insurance producer / individual research'
        : insuranceEntityClass === 'insurer'
          ? 'Legal insurer research'
          : insuranceEntityClass === 'agency'
            ? 'Insurance agency research'
            : 'Insurance regulatory research';
  } else if (investor) {
    intent = 'entity';
    hubs.push('investor');
    topic =
      investorFirmType === 'ria'
        ? 'RIA research'
        : investorFirmType === 'era'
          ? 'ERA research'
          : 'Investment-adviser firm research';
  } else if (mover) {
    intent = 'entity';
    hubs.push('move');
    topic = 'Mover identity research';
  } else if (geo) {
    intent = 'place';
    hubs.push('contractor', 'lender', 'insurance', 'move');
    topic = geo.countyName ? `${geo.countyName} research` : 'Florida research';
  }

  const interpretationLines: Array<{ label: string; value: string }> = [];
  if (intent === 'journey') interpretationLines.push({ label: 'Situation', value: topic });
  else interpretationLines.push({ label: 'Topic', value: topic });
  const insuranceOnly = hubs.length === 1 && hubs[0] === 'insurance';
  if (insuranceOnly) {
    if (insuranceEntityClass) {
      interpretationLines.push({
        label: 'Entity class',
        value:
          insuranceEntityClass === 'person'
            ? 'Producer / individual'
            : insuranceEntityClass === 'insurer'
              ? 'Legal insurer'
              : 'Agency',
      });
    }
    const geoMeaning = insuranceGeographyMeaning(query);
    if (/\bcredential jurisdiction\b/i.test(geoMeaning) && geo?.stateName) {
      interpretationLines.push({ label: 'credential jurisdiction', value: geo.stateName });
    } else if (/\bdomicile\b/i.test(geoMeaning) && geo?.stateName) {
      interpretationLines.push({ label: 'regulatory domicile', value: geo.stateName });
    } else if (geo?.countyName) {
      interpretationLines.push({ label: 'Geography (not service territory)', value: `${geo.countyName}, Florida` });
    } else if (geo?.stateName) {
      interpretationLines.push({ label: 'Geography', value: geo.stateName });
    }
  } else if (geo?.countyName) interpretationLines.push({ label: 'Location', value: `${geo.countyName}, Florida` });
  else if (geo?.stateName) interpretationLines.push({ label: 'Location', value: geo.stateName });
  if (trade) interpretationLines.push({ label: 'Trade', value: trade });
  if (credentialStatus) interpretationLines.push({ label: 'Credential status', value: credentialStatus });
  if (id && !id.ambiguous) interpretationLines.push({ label: 'Identifier', value: `${id.family.label}: ${id.raw}` });
  if (seniorProviderClass) {
    interpretationLines.push({
      label: 'Provider class',
      value:
        seniorProviderClass === 'nursing_home'
          ? 'Nursing Home'
          : seniorProviderClass === 'home_health'
            ? 'Home Health'
            : 'Hospice',
    });
  }
  if (investorFirmType && hubs.includes('investor') && hubs.length === 1) {
    interpretationLines.push({
      label: 'Firm type',
      value: investorFirmType === 'ria' ? 'RIA' : investorFirmType === 'era' ? 'ERA' : 'RIA + ERA (kept separate)',
    });
    if (geo?.stateName) {
      interpretationLines.push({
        label: 'Principal-office state',
        value: geo.stateName,
      });
    }
  }
  if (hubs.length === 1) {
    interpretationLines.push({ label: 'Research system', value: hubs[0] });
  } else if (hubs.length > 1) {
    interpretationLines.push({ label: 'Research systems', value: hubs.join(' · ') });
  }

  return {
    query,
    intent,
    geography: geo,
    trade,
    credentialStatus,
    identifier: id,
    nameQuery,
    suggestedHubs: hubs,
    topic,
    interpretationLines,
    seniorProviderClass,
    investorFirmType,
    insuranceEntityClass,
  };
}
