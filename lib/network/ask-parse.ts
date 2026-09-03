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
import {
  detectMoveRole,
  isAutoTransportQuery,
  isAmbiguousCarrierQuery,
  isMoveClassQuery,
  moveGeographyMeaning,
  type MoveRegulatoryRole,
  type MoveResearchCategory,
} from './move-ask.ts';
import {
  isAmbiguousBrokerQuery,
  isLenderClassQuery,
  isLenderComparisonQuery,
  lenderGeographyMeaning,
} from './lender-ask.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';
import { classifyUniversalQuery, type UniversalQueryClassification } from './query-classification.ts';
import { detectNjCounty } from './nj-network.ts';

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
  stateCode?: string;
  stateName?: string;
  countySlug?: 'broward' | 'palm-beach';
  countyName?: string;
  city?: string;
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
  moveRegulatoryRole?: MoveRegulatoryRole;
  moveResearchCategory?: MoveResearchCategory;
  queryClassification: UniversalQueryClassification;
};

const FL = /\bflorida\b|\bfl\b/i;
const BROWARD = /\bbroward\b/i;
const PALM = /\bpalm\s*beach\b/i;

function geography(q: string): ParsedGeography | undefined {
  const broward = BROWARD.test(q);
  const palm = PALM.test(q);
  const tampa = /\btampa(\s+bay)?\b/i.test(q);
  const miami = /\bmiami([-\s]?dade)?\b/i.test(q);
  const bocaRaton = /\bboca\s+raton\b/i.test(q);
  const florida = FL.test(q) || broward || palm || tampa || miami || bocaRaton;
  const njNamedEarly = /\bnew\s+jersey\b|\bn\.?j\.?\b|\bnewark\b/i.test(q);
  if (njNamedEarly && florida) {
    return {
      stateCode: 'NJ',
      stateName: 'New Jersey',
      city: /\bnewark\b/i.test(q) ? 'Newark' : undefined,
      meaning:
        'New Jersey origin with Florida mentioned as destination. New Jersey state mover authority is not FMCSA interstate authority.',
    };
  }

  let city: string | undefined;
  if (tampa) city = 'Tampa';
  else if (miami) city = 'Miami';
  else if (bocaRaton) city = 'Boca Raton';

  if (broward) {
    return {
      stateCode: 'FL',
      stateName: 'Florida',
      countySlug: 'broward',
      countyName: 'Broward County',
      city,
      meaning: 'Broward County, Florida. County meaning differs by hub (mailing county ≠ service territory; HMDA property county ≠ HQ).',
    };
  }
  if (palm) {
    return {
      stateCode: 'FL',
      stateName: 'Florida',
      countySlug: 'palm-beach',
      countyName: 'Palm Beach County',
      city,
      meaning: 'Palm Beach County, Florida. County meaning differs by hub.',
    };
  }
  if (florida) {
    return {
      stateCode: 'FL',
      stateName: 'Florida',
      city,
      meaning: city
        ? `${city}, Florida. Recorded/address geography is not service territory.`
        : 'Florida. State licensing is not physical location; principal office is not client geography.',
    };
  }

  const njCounty = detectNjCounty(q);
  const newark = /\bnewark\b/i.test(q);
  const njNamed = /\bnew\s+jersey\b|\bn\.?j\.?\b/i.test(q) || newark;
  const njStrongCounty = /\b(bergen|hudson|middlesex|monmouth)\s+county\b/i.test(q);
  const otherStateNamed = US_JURISDICTIONS.some(
    (j) => j.code !== 'NJ' && j.code !== 'FL' && new RegExp(`\\b${j.name.replace(/\s+/g, '\\s+')}\\b`, 'i').test(q),
  );
  const newJersey = njNamed || (Boolean(njCounty) && njStrongCounty && !otherStateNamed);
  if (newJersey) {
    return {
      stateCode: 'NJ',
      stateName: 'New Jersey',
      countyName: njCounty,
      city: newark ? 'Newark' : city,
      meaning: njCounty
        ? `${njCounty}, New Jersey. County meaning stays source-specific to the specialist hub.`
        : newark
          ? 'Newark, New Jersey. City is not automatically a license territory.'
          : 'New Jersey. State licensing is not physical location; specialist geography meaning differs by hub.',
    };
  }

  const byName = [...US_JURISDICTIONS].sort((a, b) => b.name.length - a.name.length).find((j) => {
    const nameRe = new RegExp(`\\b${j.name.replace(/\s+/g, '\\s+')}\\b`, 'i');
    return nameRe.test(q);
  });
  if (byName) {
    const beforeState = q.match(new RegExp(`\\b(?:in|near|around)\\s+([a-z][a-z .'-]{1,40}?)\\s+${byName.name.replace(/\s+/g, '\\s+')}\\b`, 'i'));
    if (!city && beforeState?.[1]) city = beforeState[1].trim().replace(/\b\w/g, (letter) => letter.toUpperCase());
    return {
      stateCode: byName.code,
      stateName: byName.name,
      city,
      meaning: `${byName.name}. Geography meaning stays source-specific to the specialist.`,
    };
  }

  const postal = q.match(/\b(?:N\.?J\.?|N\.?Y\.?|C\.?A\.?|T\.?X\.?|F\.?L\.?)\b/i);
  if (postal) {
    const raw = postal[0].replace(/\./g, '').toUpperCase();
    const j = US_JURISDICTIONS.find((row) => row.code === raw);
    if (j) {
      const beforeState = q.match(new RegExp(`\\b(?:in|near|around)\\s+([a-z][a-z .'-]{1,40}?)\\s+${postal[0].replace(/\./g, '\\.?')}\\b`, 'i'));
      if (!city && beforeState?.[1]) city = beforeState[1].trim().replace(/\b\w/g, (letter) => letter.toUpperCase());
      return {
        stateCode: j.code,
        stateName: j.name,
        city,
        meaning: `${j.name}. Geography meaning stays source-specific to the specialist.`,
      };
    }
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
  const usdotInSentence = trimmed.match(/\b(?:usdot|dot)\s*#?\s*(\d{3,8})\b/i);
  if (usdotInSentence) {
    const family = IDENTIFIER_FAMILIES.find((f) => f.id === 'usdot');
    if (family) {
      return { family, raw: `USDOT ${usdotInSentence[1]}`, ambiguous: false, note: family.note };
    }
  }
  const mcInSentence = trimmed.match(/\bmc\s*#?-?\s*(\d{3,8})\b/i);
  if (mcInSentence) {
    const family = IDENTIFIER_FAMILIES.find((f) => f.id === 'mc');
    if (family) {
      return { family, raw: `MC ${mcInSentence[1]}`, ambiguous: false, note: family.note };
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
  const placeQ = /what (do you|does trusthub) know about|research in broward|about broward|about palm beach|about florida|about new jersey|research in new jersey|research new jersey/i.test(query);
  const contractor = /contractor|roof(ing|er)|hvac|plumb|electrical|general contractor|builder|remodeler|dbpr|cilb/i.test(query);
  const lender = isLenderClassQuery(query) || /lender|mortgage|hmda|fha|\bva\b|home loan|nmls|loan officer|down[- ]payment|njhmfa|\bdpa\b|denial rate/i.test(query);
  const mover = isMoveClassQuery(query);
  const moveResearchCategory = isAutoTransportQuery(query) ? 'auto_transport' as const : undefined;
  const insurance =
    isInsuranceClassQuery(query) ||
    (/insur(ance|er)|doi|producer|agency license|\bnpn\b|\bnaic\b/i.test(query) && !mover);
  const insuranceEntityClass = detectInsuranceEntityClass(query);
  const investor = isInvestorClassQuery(query) || /adviser|advisor|form adv|iard|crd|ria\b|era\b|investment firm/i.test(query);
  const investorFirmType = detectInvestorFirmType(query);
  const moveRegulatoryRole = mover ? detectMoveRole(query) : undefined;
  const ambiguousCarrier = isAmbiguousCarrierQuery(query);
  const ambiguousBroker = isAmbiguousBrokerQuery(query);
  const roofing = /roof/i.test(query);
  const fha = /\bfha\b/i.test(query);

  let intent: NetworkAskIntent = 'definition';
  const hubs: SpecialistHubId[] = [];
  let topic = 'Research question';
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
  } else if (isLenderComparisonQuery(query)) {
    intent = 'comparison';
    hubs.push('lender');
    topic = 'HMDA mortgage-market comparison';
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
    else if (/electrical|electrician/i.test(query)) trade = 'Electrical';
    else if (/\bhvac\b/i.test(query)) trade = 'HVAC';
    else if (/plumb/i.test(query)) trade = 'Plumbing';
    else if (/general contractor/i.test(query)) trade = 'General Contractor';
    if (/active|current/i.test(query) || (roofing && geo?.countySlug)) credentialStatus = 'Active/current';
  } else if (fha || (lender && !buying)) {
    intent = 'market';
    hubs.push('lender');
    topic = fha ? 'FHA / mortgage-market research' : 'Lending research';
  } else if (mover) {
    intent = moveResearchCategory ? 'market' : 'entity';
    hubs.push('move');
    topic =
      moveResearchCategory
        ? 'Auto transport research'
        : moveRegulatoryRole === 'broker'
        ? 'Household-goods broker research'
        : moveRegulatoryRole === 'carrier_broker'
          ? 'Carrier / broker research'
          : /\b(fdacs|intrastate mover|im registration)\b/i.test(query)
            ? 'Florida Intrastate Mover registration research'
            : 'Household-goods motor carrier research';
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
  } else if (ambiguousCarrier || ambiguousBroker) {
    intent = 'definition';
    topic = ambiguousBroker ? 'Ambiguous “broker”' : 'Ambiguous “carrier”';
  } else if (investor) {
    intent = 'entity';
    hubs.push('investor');
    topic =
      investorFirmType === 'ria'
        ? 'RIA research'
        : investorFirmType === 'era'
          ? 'ERA research'
          : 'Investment-adviser firm research';
  } else if (geo) {
    intent = 'place';
    hubs.push('contractor', 'lender', 'insurance', 'move');
    topic = geo.countyName ? `${geo.countyName} research` : 'Florida research';
  }

  const queryClassification = classifyUniversalQuery({
    query,
    exactIdentifier: Boolean(id && !id.ambiguous),
    ambiguousIdentifier: id?.ambiguous,
    suggestedHubs: hubs,
    geography: geo,
    intentHint: intent,
  });

  const interpretationLines: Array<{ label: string; value: string }> = [];
  if (intent === 'journey') interpretationLines.push({ label: 'Situation', value: topic });
  else interpretationLines.push({ label: 'Topic', value: topic });
  const moveOnly = hubs.length === 1 && hubs[0] === 'move';
  const insuranceOnly = hubs.length === 1 && hubs[0] === 'insurance';
  const lenderOnly = hubs.length === 1 && hubs[0] === 'lender';
  if (ambiguousCarrier && !hubs.length) {
    interpretationLines.push({
      label: 'Limitation',
      value:
        '“Carrier” is ambiguous. It may mean a household-goods motor carrier or an insurance legal insurer. Use a labeled USDOT/MC or a labeled NAIC, or say mover vs insurance.',
    });
  }
  if (ambiguousBroker && !hubs.length) {
    interpretationLines.push({
      label: 'Limitation',
      value:
        '“Broker” is ambiguous. It may mean a household-goods broker, a mortgage broker, an insurance broker, or a broker-dealer. Name the regulated role.',
    });
  }
  if (moveOnly) {
    interpretationLines.push({ label: 'Specialist', value: 'MoveTrustHub' });
    if (moveResearchCategory === 'auto_transport') {
      interpretationLines.push({ label: 'Research topic', value: 'Auto transport' });
    }
    if (moveRegulatoryRole) {
      interpretationLines.push({
        label: 'Regulatory role',
        value: moveRegulatoryRole === 'carrier_broker' ? 'Carrier / Broker' : moveRegulatoryRole === 'broker' ? 'Broker' : 'Carrier',
      });
    }
    const geoMeaning = moveGeographyMeaning(query);
    if (/\bintrastate mover registration\b/i.test(geoMeaning)) {
      interpretationLines.push({ label: 'Geography', value: 'Florida IM registration — not FMCSA interstate authority, not service territory' });
    } else if (geo?.stateName && !id) {
      interpretationLines.push({ label: 'Geography (headquarters, not service territory)', value: geo.stateName });
      interpretationLines.push({
        label: 'Does not mean',
        value: 'Serves only this state. Interstate carriers may operate in many states.',
      });
    }
  } else if (insuranceOnly) {
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
  } else if (lenderOnly && intent !== 'identifier') {
    interpretationLines.push({
      label: 'Geography (HMDA property, not HQ)',
      value: geo?.countyName ? `${geo.countyName}, Florida` : geo?.stateName ?? 'See specialist result',
    });
    interpretationLines.push({
      label: 'Does not mean',
      value: 'Lender headquarters, branch county, or service territory.',
    });
    const geoMeaning = lenderGeographyMeaning(query);
    if (/rate|denominator/i.test(geoMeaning)) {
      interpretationLines.push({ label: 'Limitation', value: geoMeaning });
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
  if (hubs[0] === 'investor' && hubs.length === 1) {
    if (investorFirmType) interpretationLines.push({
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
    moveRegulatoryRole,
    moveResearchCategory,
    queryClassification,
  };
}
