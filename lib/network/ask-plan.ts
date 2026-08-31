import { capabilityFor } from './capability-registry.ts';
import { parseNetworkAsk, type ParsedNetworkAsk } from './ask-parse.ts';
import { compareBrowardPalmBeach } from './place-comparison.ts';
import { browardPlaceLens, floridaPlaceLens, palmBeachPlaceLens, type PlaceLens } from './place-lens.ts';
import { listNetworkSourceRows } from './source-registry.ts';
import { NETWORK_PUBLIC_NAMES, type SpecialistHubId } from './registry.ts';
import { runNameCheck, type NameCheckResult } from './name-check.ts';
import { IDENTIFIER_FAMILIES } from './identifiers.ts';
import {
  SENIOR_ASK_CONTRACT,
  SENIOR_PROVIDER_CLASS_LABEL,
  fetchSeniorAsk,
  seniorAskMode,
  seniorAskUrl,
  seniorFailClosedReason,
  seniorGeographyMeaning,
  type SeniorAskPayload,
} from './senior-ask.ts';
import {
  INVESTOR_ASK_CONTRACT,
  INVESTOR_FIRM_TYPE_LABEL,
  fetchInvestorAsk,
  investorAskMode,
  investorAskUrl,
  investorFailClosedReason,
  investorGeographyMeaning,
  type InvestorAskPayload,
} from './investor-ask.ts';
import {
  INSURANCE_ASK_CONTRACT,
  INSURANCE_ENTITY_CLASS_LABEL,
  fetchInsuranceAsk,
  insuranceAskMode,
  insuranceAskUrl,
  insuranceFailClosedReason,
  insuranceGeographyMeaning,
  type InsuranceAskPayload,
} from './insurance-ask.ts';
import {
  MOVE_ASK_CONTRACT,
  MOVE_ROLE_LABEL,
  fetchMoveAsk,
  moveAskMode,
  moveAskUrl,
  moveFailClosedReason,
  moveGeographyMeaning,
  type MoveAskPayload,
} from './move-ask.ts';
import {
  LENDER_ASK_CONTRACT,
  fetchLenderAsk,
  lenderAskMode,
  lenderAskUrl,
  lenderFailClosedReason,
  lenderGeographyMeaning,
  type LenderAskPayload,
} from './lender-ask.ts';
import { contractorAskUrlFromParsed } from './ask-plan-urls.ts';
import { isSpecificIdentityRequest, requestedIdentityName, type AskDiagnostics, type AskResultClass, type IdentityResolutionClass } from './result-contract.ts';
import {
  applyConsumerPresentation,
  fetchContractorAskOptions,
  optionsFromInsurancePayload,
  optionsFromInvestorPayload,
  optionsFromLenderPayload,
  optionsFromMovePayload,
  optionsFromSeniorPayload,
  type ConsumerFollowUp,
  type ConsumerOption,
  type FailKind,
} from './consumer-ask.ts';

export type HubCapabilityStatus = 'execute' | 'handoff' | 'unsupported' | 'unavailable';

export type NetworkAskHubPlan = {
  hubId: SpecialistHubId;
  name: string;
  capabilityStatus: HubCapabilityStatus;
  mode?: string;
  structuredFilters?: Record<string, unknown>;
  destination?: string;
  reason: string;
  whatItCanAnswer: string;
  geographyCapability: string;
  failKind?: FailKind;
  judgmentNote?: string;
  searchQuery?: string;
  options?: ConsumerOption[];
  followUp?: ConsumerFollowUp;
  matchWhy?: string;
  compareHref?: string;
  preview?: {
    headline: string;
    grain: string;
    limitation: string;
    officialAsOf?: string;
    sourceFamily?: string;
  };
};

export type NetworkAskPlan = {
  query: string;
  intent: ParsedNetworkAsk['intent'];
  parsed: ParsedNetworkAsk;
  hubs: NetworkAskHubPlan[];
  placeLensHref?: string;
  comparison?: ReturnType<typeof compareBrowardPalmBeach>;
  nameCheck?: NameCheckResult;
  routingMs: number;
};

export type TraceRow = {
  hubId: SpecialistHubId;
  hubName: string;
  sourceFamily: string;
  queryGrain: string;
  geographyMeaning: string;
  officialAsOf: string;
  specialistDestination: string;
  contract?: string;
  providerClass?: string;
  identifier?: string;
};

export type NetworkAskAnswer = {
  plan: NetworkAskPlan;
  interpretation: ParsedNetworkAsk['interpretationLines'];
  hubCountLabel: string;
  traces: TraceRow[];
  changeHref: string;
  options?: ConsumerOption[];
  judgmentNote?: string;
  followUp?: ConsumerFollowUp;
  matchWhy?: string;
  limitation?: string;
  compareHref?: string;
  resultClass: AskResultClass;
  identityResolutionClass?: IdentityResolutionClass;
  noResult?: { headline: string; understood: string; actions: string[] };
  diagnostics: AskDiagnostics;
};

function contractorAskUrl(parsed: ParsedNetworkAsk): string {
  return contractorAskUrlFromParsed(parsed);
}

function identifierDestination(parsed: ParsedNetworkAsk): string | undefined {
  const id = parsed.identifier;
  if (!id || id.ambiguous) return undefined;
  if (!id.family.live) return id.family.destinationHint;
  if (id.family.id === 'usdot' || id.family.id === 'mc') {
    return moveAskUrl(parsed.query);
  }
  if (id.family.id === 'state_contractor_license') {
    return `https://www.contractortrusthub.com/verify?q=${encodeURIComponent(id.raw)}`;
  }
  if (id.family.id === 'crd') {
    return investorAskUrl(parsed.query);
  }
  if (id.family.id === 'cms_ccn') {
    return seniorAskUrl(parsed.query);
  }
  if (id.family.id === 'npn' || id.family.id === 'naic_company_code') {
    return insuranceAskUrl(parsed.query);
  }
  return id.family.destinationHint;
}

function placeHref(parsed: ParsedNetworkAsk): string | undefined {
  if (parsed.geography?.countySlug === 'broward') return '/places/florida/broward';
  if (parsed.geography?.countySlug === 'palm-beach') return '/places/florida/palm-beach';
  if (parsed.geography?.stateCode === 'FL') return '/places/florida';
  return undefined;
}

function lensFor(parsed: ParsedNetworkAsk): PlaceLens | undefined {
  if (parsed.geography?.countySlug === 'broward') return browardPlaceLens();
  if (parsed.geography?.countySlug === 'palm-beach') return palmBeachPlaceLens();
  if (parsed.geography?.stateCode === 'FL' && parsed.intent === 'place') return floridaPlaceLens();
  return undefined;
}

function investorHubPlan(parsed: ParsedNetworkAsk): NetworkAskHubPlan {
  const firmType = parsed.investorFirmType;
  const identifier = parsed.intent === 'identifier' && parsed.identifier && !parsed.identifier.ambiguous;
  const mode = investorAskMode(parsed.query, { identifier: Boolean(identifier) });
  const failReason = investorFailClosedReason(parsed.query);
  const dest = investorAskUrl(parsed.query);
  const geoMeaning = identifier
    ? 'Identifier routing — labeled CRD, not geography.'
    : investorGeographyMeaning(parsed.query);

  return {
    hubId: 'investor',
    name: NETWORK_PUBLIC_NAMES.investor,
    capabilityStatus: 'execute',
    mode,
    structuredFilters: {
      contract: INVESTOR_ASK_CONTRACT,
      firmType,
      identifier: identifier ? parsed.identifier?.raw : undefined,
    },
    destination: dest,
    reason:
      'InvestorTrustHub structured Ask is production-live (investor-ask-v1). Parent constructs the Ask URL and may read GET /api/ask; it does not query the Investor database.',
    whatItCanAnswer: failReason
      ? failReason
      : firmType
        ? `${INVESTOR_FIRM_TYPE_LABEL[firmType]} research on InvestorTrustHub. RIA is not ERA. Principal office is not client geography. RAUM is not performance. Item 5.E is not a fee amount.`
        : 'InvestorTrustHub Ask for SEC/IARD firm research. RIA and ERA stay separate.',
    geographyCapability: geoMeaning,
    preview: {
      headline: failReason
        ? failReason
        : identifier
          ? 'Open InvestorTrustHub structured Ask for this labeled CRD.'
          : `Open InvestorTrustHub structured Ask${firmType ? ` for ${INVESTOR_FIRM_TYPE_LABEL[firmType]}` : ''}.`,
      grain: failReason
        ? 'fail_closed'
        : identifier
          ? 'Labeled organization CRD identity'
          : firmType === 'ria'
            ? 'RIA firm facts (form_adv_firm_facts)'
            : firmType === 'era'
              ? 'ERA firm facts (form_adv_firm_facts)'
              : 'SEC/IARD roster firm facts — RIA and ERA kept separate',
      limitation:
        failReason ??
        'Parent does not invent RAUM, fees, rankings, or client geography. Open the specialist result.',
      officialAsOf: 'See specialist result',
      sourceFamily: 'sec-iard-adv',
    },
  };
}

function insuranceHubPlan(parsed: ParsedNetworkAsk): NetworkAskHubPlan {
  const cls = parsed.insuranceEntityClass;
  const classLabel = cls ? INSURANCE_ENTITY_CLASS_LABEL[cls] : undefined;
  const identifier = parsed.intent === 'identifier' && parsed.identifier && !parsed.identifier.ambiguous;
  const mode = insuranceAskMode(parsed.query, { identifier: Boolean(identifier) });
  const failReason = insuranceFailClosedReason(parsed.query);
  const dest = insuranceAskUrl(parsed.query);
  const geoMeaning = identifier
    ? 'Identifier routing — labeled NPN or NAIC company code, not geography.'
    : insuranceGeographyMeaning(parsed.query);

  return {
    hubId: 'insurance',
    name: NETWORK_PUBLIC_NAMES.insurance,
    capabilityStatus: 'execute',
    mode,
    structuredFilters: {
      contract: INSURANCE_ASK_CONTRACT,
      entityClass: cls,
      identifier: identifier ? parsed.identifier?.raw : undefined,
    },
    destination: dest,
    reason:
      'InsuranceTrustHub structured Ask is production-live (insurance-ask-v1). Parent constructs the Ask URL and may read GET /api/ask; it does not query the Insurance database.',
    whatItCanAnswer: failReason
      ? failReason
      : classLabel
        ? `${classLabel} research on InsuranceTrustHub. Person, agency, and legal insurer stay separate. Credential jurisdiction is not office, domicile, or service territory. LOA is not appointment.`
        : 'InsuranceTrustHub Ask for person, agency, and legal-insurer research. Classes stay separate.',
    geographyCapability: geoMeaning,
    preview: {
      headline: failReason
        ? failReason
        : identifier
          ? 'Open InsuranceTrustHub structured Ask for this labeled identifier.'
          : `Open InsuranceTrustHub structured Ask${classLabel ? ` for ${classLabel}` : ''}.`,
      grain: failReason
        ? 'fail_closed'
        : identifier
          ? parsed.identifier?.family.id === 'naic_company_code'
            ? 'Labeled legal-insurer NAIC identity'
            : 'Labeled NPN identity — class is not assumed from the digits'
          : classLabel
            ? `canonical ${cls} entity`
            : 'canonical insurance identity (classes kept separate)',
      limitation:
        failReason ??
        'Parent does not invent appointments, LOAs, rankings, or a combined insurance-providers total. Open the specialist result. Empty current-data results are not “no authority.”',
      officialAsOf: 'See specialist result',
      sourceFamily: 'state-doi',
    },
  };
}

function moveHubPlan(parsed: ParsedNetworkAsk): NetworkAskHubPlan {
  const role = parsed.moveRegulatoryRole;
  const roleLabel = role ? MOVE_ROLE_LABEL[role] : undefined;
  const identifier = parsed.intent === 'identifier' && parsed.identifier && !parsed.identifier.ambiguous;
  const mode = moveAskMode(parsed.query, { identifier: Boolean(identifier) });
  const failReason = moveFailClosedReason(parsed.query);
  const dest = moveAskUrl(parsed.query);
  const geoMeaning = identifier
    ? 'Identifier routing — labeled USDOT or MC, not geography.'
    : moveGeographyMeaning(parsed.query);

  return {
    hubId: 'move',
    name: NETWORK_PUBLIC_NAMES.move,
    capabilityStatus: 'execute',
    mode,
    structuredFilters: {
      contract: MOVE_ASK_CONTRACT,
      role,
      identifier: identifier ? parsed.identifier?.raw : undefined,
    },
    destination: dest,
    reason:
      'MoveTrustHub structured Ask is production-live (move-ask-v1). Parent constructs the Ask URL and may read GET /api/ask; it does not query the Move database.',
    whatItCanAnswer: failReason
      ? failReason
      : roleLabel
        ? `${roleLabel} research on MoveTrustHub. Carrier ≠ broker. Headquarters is not service territory. Florida IM registration is not interstate authority. Authority is not a recommendation.`
        : 'MoveTrustHub Ask for carrier, broker, and Florida IM registration research. Grains stay separate.',
    geographyCapability: geoMeaning,
    preview: {
      headline: failReason
        ? failReason
        : identifier
          ? 'Open MoveTrustHub structured Ask for this labeled USDOT or MC.'
          : `Open MoveTrustHub structured Ask${roleLabel ? ` for ${roleLabel}` : ''}.`,
      grain: failReason
        ? 'fail_closed'
        : identifier
          ? parsed.identifier?.family.id === 'mc'
            ? 'Labeled MC docket identity — not a ranking'
            : 'Labeled USDOT identity — not an endorsement'
          : /\b(fdacs|intrastate mover|im registration)\b/i.test(parsed.query)
            ? 'FDACS Intrastate Mover registration rows'
            : roleLabel
              ? `directory ${roleLabel} profiles (dual-role disclosed, not double-counted)`
              : 'FMCSA directory profiles',
      limitation:
        failReason ??
        'Parent does not invent transporter identity, service territory, rankings, or a combined “moving companies” total. Open the specialist result.',
      officialAsOf: 'See specialist result',
      sourceFamily: /\b(fdacs|intrastate mover|im registration)\b/i.test(parsed.query)
        ? 'fdacs-florida'
        : 'fmcsa-directory-cohort',
    },
  };
}

function lenderHubPlan(parsed: ParsedNetworkAsk): NetworkAskHubPlan {
  const failReason = lenderFailClosedReason(parsed.query);
  const mode = lenderAskMode(parsed.query);
  const dest = lenderAskUrl(parsed.query);
  const geoMeaning = lenderGeographyMeaning(parsed.query);
  const complaint = /\bcomplaint\b|\bcfpb\b/i.test(parsed.query);

  return {
    hubId: 'lender',
    name: NETWORK_PUBLIC_NAMES.lender,
    capabilityStatus: 'execute',
    mode: failReason ? 'fail_closed' : mode,
    structuredFilters: {
      contract: LENDER_ASK_CONTRACT,
      loanType: /\bfha\b/i.test(parsed.query) ? ['FHA'] : undefined,
      geography: parsed.geography?.countySlug ?? parsed.geography?.stateCode,
    },
    destination: dest,
    reason:
      'LenderTrustHub structured Ask is production-live (lender-ask-v1). Parent constructs the Ask URL and may read GET /api/ask; it does not query the Lender database.',
    whatItCanAnswer: failReason
      ? failReason
      : complaint
        ? 'CFPB mortgage complaint observations on LenderTrustHub. Complaints are not confirmed wrongdoing. Absence is not a clean record.'
        : 'LenderTrustHub Ask for HMDA mortgage-market research. Most is a raw volume count, not a recommendation. Property geography is not headquarters or service territory.',
    geographyCapability: geoMeaning,
    preview: {
      headline: failReason ? failReason : 'Open LenderTrustHub structured Ask for this HMDA / CFPB query.',
      grain: failReason
        ? 'fail_closed'
        : complaint
          ? 'CFPB mortgage complaint observations — not confirmed wrongdoing'
          : parsed.geography?.countySlug
            ? 'HMDA 2025 mortgaged-property county observations (not branch county, HQ, or service territory)'
            : 'HMDA 2025 mortgaged-property state observations (not headquarters or service territory)',
      limitation:
        failReason ??
        'Parent does not invent origination counts, rates, rankings, or service territory. Open the specialist result. Most is a raw count; a rate needs a denominator.',
      officialAsOf: 'See specialist result',
      sourceFamily: complaint ? 'cfpb-complaints' : 'hmda',
    },
  };
}

function seniorHubPlan(parsed: ParsedNetworkAsk): NetworkAskHubPlan {
  const cls = parsed.seniorProviderClass;
  const classLabel = cls ? SENIOR_PROVIDER_CLASS_LABEL[cls] : undefined;
  const identifier = parsed.intent === 'identifier' && parsed.identifier && !parsed.identifier.ambiguous;
  const mode = seniorAskMode(parsed.query, { identifier: Boolean(identifier) });
  const failReason = seniorFailClosedReason(parsed.query);
  const dest = seniorAskUrl(parsed.query);
  const geoMeaning = identifier ? 'Identifier routing — labeled CMS CCN, not geography.' : seniorGeographyMeaning(parsed.query, cls);

  return {
    hubId: 'senior',
    name: NETWORK_PUBLIC_NAMES.senior,
    capabilityStatus: 'execute',
    mode,
    structuredFilters: {
      contract: SENIOR_ASK_CONTRACT,
      providerClass: cls,
      identifier: identifier ? parsed.identifier?.raw : undefined,
    },
    destination: dest,
    reason:
      'SeniorTrustHub structured Ask is production-live (senior-ask-v1). Parent constructs the Ask URL and may read GET /api/ask; it does not query the Senior database.',
    whatItCanAnswer: failReason
      ? failReason
      : classLabel
        ? `${classLabel} research on SeniorTrustHub. Classes stay separate. CMS ratings are not TrustHub recommendations.`
        : 'SeniorTrustHub Ask for Nursing Home, Home Health, or Hospice. Classes stay separate.',
    geographyCapability: geoMeaning,
    preview: {
      headline: failReason
        ? failReason
        : identifier
          ? 'Open SeniorTrustHub structured Ask for this labeled CMS CCN.'
          : `Open SeniorTrustHub structured Ask${classLabel ? ` for ${classLabel}` : ''}.`,
      grain: failReason ? 'fail_closed' : identifier ? 'Labeled CMS CCN identity' : `${classLabel ?? 'Provider class'} directory research`,
      limitation:
        failReason ??
        'Parent does not invent provider facts, rankings, or a combined senior-provider total. Open the specialist result.',
      officialAsOf: 'See specialist result',
      sourceFamily: 'cms-care-compare',
    },
  };
}

function hubPlan(hubId: SpecialistHubId, parsed: ParsedNetworkAsk): NetworkAskHubPlan {
  const cap = capabilityFor(hubId);
  const name = NETWORK_PUBLIC_NAMES[hubId];
  const lens = lensFor(parsed);
  const card = lens?.hubs.find((h) => h.hubId === hubId);

  if (parsed.intent === 'identifier' && parsed.identifier?.ambiguous) {
    return {
      hubId,
      name,
      capabilityStatus: 'unsupported',
      reason: collidingNote(),
      whatItCanAnswer: 'Ask will not auto-select a hub from bare digits.',
      geographyCapability: 'n/a',
    };
  }

  const seniorExecute =
    parsed.seniorProviderClass ||
    parsed.identifier?.family.id === 'cms_ccn' ||
    (parsed.suggestedHubs.length === 1 && parsed.suggestedHubs[0] === 'senior');
  if (hubId === 'senior' && seniorExecute) {
    return seniorHubPlan(parsed);
  }

  const investorExecute =
    parsed.investorFirmType ||
    parsed.identifier?.family.id === 'crd' ||
    (parsed.suggestedHubs.length === 1 && parsed.suggestedHubs[0] === 'investor');
  if (hubId === 'investor' && investorExecute) {
    return investorHubPlan(parsed);
  }

  const insuranceExecute =
    parsed.insuranceEntityClass ||
    parsed.identifier?.family.id === 'npn' ||
    parsed.identifier?.family.id === 'naic_company_code' ||
    (parsed.suggestedHubs.length === 1 && parsed.suggestedHubs[0] === 'insurance');
  if (hubId === 'insurance' && insuranceExecute) {
    return insuranceHubPlan(parsed);
  }

  const moveExecute =
    parsed.moveRegulatoryRole ||
    parsed.identifier?.family.id === 'usdot' ||
    parsed.identifier?.family.id === 'mc' ||
    (parsed.suggestedHubs.length === 1 && parsed.suggestedHubs[0] === 'move');
  if (hubId === 'move' && moveExecute) {
    return moveHubPlan(parsed);
  }

  const lenderExecute =
    parsed.intent !== 'identifier' &&
    parsed.suggestedHubs.length === 1 &&
    parsed.suggestedHubs[0] === 'lender';
  if (hubId === 'lender' && lenderExecute) {
    return lenderHubPlan(parsed);
  }

  if (parsed.intent === 'identifier' && parsed.identifier) {
    const dest = identifierDestination(parsed);
    const live = parsed.identifier.family.live && parsed.identifier.family.hubId === hubId;
    return {
      hubId,
      name,
      capabilityStatus: live ? (cap.federatedExecution === 'execute' ? 'execute' : 'handoff') : 'handoff',
      mode: 'identifier',
      destination: dest,
      reason: live
        ? `${name} supports this identifier pattern on a public lookup.`
        : `${parsed.identifier.family.label} is documented. Live federated lookup is ${parsed.identifier.family.live ? 'a specialist handoff' : 'not claimed'}.`,
      whatItCanAnswer: parsed.identifier.family.note,
      geographyCapability: 'Identifier routing — not geography.',
    };
  }

  if (hubId === 'contractor' && (parsed.intent === 'entity' || parsed.trade)) {
    const dest = contractorAskUrl(parsed);
    const hireClosed =
      /\b(should i hire|who should i hire|best contractor|safest contractor|most trustworthy contractor|recommended contractor|hire this contractor)\b/i.test(
        parsed.query,
      );
    const failReason = hireClosed
      ? 'ContractorTrustHub does not recommend whom to hire. It researches licensing records. A credential is not a ranking.'
      : undefined;
    const browardRoof = parsed.geography?.countySlug === 'broward' && parsed.trade === 'Roofing';
    return {
      hubId,
      name,
      capabilityStatus: 'execute',
      mode: failReason ? 'fail_closed' : 'entity',
      structuredFilters: {
        geo: parsed.geography?.countySlug,
        trade: parsed.trade?.toLowerCase(),
        status: parsed.credentialStatus ? 'active_current' : undefined,
      },
      destination: dest,
      reason: 'ContractorTrustHub structured Ask is production-live. Parent constructs the Ask URL; it does not query the contractor database.',
      whatItCanAnswer: failReason ?? 'Indexed licensing records by geography, trade, and credential status.',
      geographyCapability: parsed.geography?.meaning ?? 'State/county as recorded on the credential — not service territory.',
      preview: failReason
        ? {
            headline: failReason,
            grain: 'fail_closed',
            limitation: failReason,
            officialAsOf: '2026-08-28',
            sourceFamily: 'fl-dbpr',
          }
        : browardRoof
        ? {
            headline: 'ContractorTrustHub published 924 active Broward roofing credentials on its county intelligence page.',
            grain: 'Certified CCC + registered RC with mailing/base county Broward. Credential records, not companies, not “trusted roofers.”',
            limitation: 'Credential records are shown for research only. Their order is not a ranking or recommendation.',
            officialAsOf: '2026-08-10',
            sourceFamily: 'fl-dbpr',
          }
        : {
            headline: 'Open ContractorTrustHub structured Ask for matching credential records.',
            grain: 'Ask lean path: parameterized contractors ⋈ licenses.',
            limitation: 'Parent does not invent a match count.',
            officialAsOf: '2026-08-28',
            sourceFamily: 'fl-dbpr',
          },
    };
  }

  if (card) {
    const status: HubCapabilityStatus =
      card.capability === 'enhanced_county_intelligence' && hubId === 'contractor'
        ? 'execute'
        : card.researchAvailable
          ? 'handoff'
          : 'unsupported';
    return {
      hubId,
      name,
      capabilityStatus: hubId === 'contractor' && parsed.intent === 'place' ? 'execute' : status,
      mode: 'place',
      destination: hubId === 'contractor' && parsed.intent === 'place' ? contractorAskUrl(parsed) : card.destination,
      reason: card.capabilityLabel,
      whatItCanAnswer: card.geographyMeaning,
      geographyCapability: card.geographyMeaning,
      preview: card.metrics[0]
        ? {
            headline: `${card.metrics[0].label}: ${card.metrics[0].value}`,
            grain: card.metrics[0].grain,
            limitation: card.metrics[0].limitation,
            officialAsOf: card.metrics[0].officialAsOf,
            sourceFamily: card.metrics[0].sourceFamilyId,
          }
        : undefined,
    };
  }

  const fallbackDest =
    cap.structuredAskUrl ||
    cap.publicSearchUrl ||
    cap.origin;
  return {
    hubId,
    name,
    capabilityStatus: cap.federatedExecution,
    mode: parsed.intent,
    destination: fallbackDest,
    reason: cap.notes[0] ?? `${name} handoff.`,
    whatItCanAnswer: cap.notes[1] ?? cap.notes[0] ?? name,
    geographyCapability: parsed.geography?.meaning ?? 'See specialist hub.',
  };
}

function collidingNote() {
  return 'Bare digits can mean USDOT, NMLS, CCN, CRD, NPN, or NAIC company code. Ask must preserve ambiguity and not auto-select a hub from digits alone.';
}

export function buildNetworkAskPlan(query: string): NetworkAskPlan {
  const started = Date.now();
  const parsed = parseNetworkAsk(query);
  let hubs: NetworkAskHubPlan[] = [];
  let comparison: NetworkAskPlan['comparison'];
  let nameCheck: NameCheckResult | undefined;

  if (parsed.intent === 'name_check') {
    nameCheck = runNameCheck(parsed.nameQuery || parsed.query);
    hubs = nameCheck.hubs.map((row) => ({
      hubId: row.hubId,
      name: NETWORK_PUBLIC_NAMES[row.hubId],
      capabilityStatus: row.status === 'not_currently_searchable' ? 'unsupported' : 'handoff',
      destination: row.destination,
      reason: row.detail,
      whatItCanAnswer: row.status,
      geographyCapability: 'Name appearance is not identity.',
    }));
  } else if (parsed.intent === 'comparison') {
    if (parsed.suggestedHubs.length === 1 && parsed.suggestedHubs[0] === 'lender') {
      hubs = [hubPlan('lender', parsed)];
    } else {
      comparison = compareBrowardPalmBeach();
      hubs = comparison.hubs.map((h) => hubPlan(h.hubId, parsed));
    }
  } else if (parsed.suggestedHubs.length) {
    hubs = parsed.suggestedHubs.map((id) => hubPlan(id, parsed));
  } else if (parsed.identifier?.ambiguous) {
    hubs = IDENTIFIER_FAMILIES.filter((f) => ['usdot', 'nmls', 'cms_ccn', 'crd', 'npn'].includes(f.id)).map((f) => ({
      hubId: f.hubId,
      name: NETWORK_PUBLIC_NAMES[f.hubId],
      capabilityStatus: 'unsupported' as const,
      reason: collidingNote(),
      whatItCanAnswer: f.label,
      geographyCapability: 'n/a',
    }));
  }

  if (hubs.length === 1) {
    hubs = [applyConsumerPresentation(hubs[0], parsed)];
  }

  return {
    query: parsed.query,
    intent: parsed.intent,
    parsed,
    hubs,
    placeLensHref: placeHref(parsed),
    comparison,
    nameCheck,
    routingMs: Date.now() - started,
  };
}

function tracesForPlan(plan: NetworkAskPlan): TraceRow[] {
  const sources = listNetworkSourceRows();
  return plan.hubs
    .filter((h) => h.capabilityStatus !== 'unsupported')
    .map((h) => {
      const famId = h.preview?.sourceFamily;
      const fam = sources.find((s) => s.hubId === h.hubId && (!famId || s.id === famId)) ?? sources.find((s) => s.hubId === h.hubId);
      const cls = plan.parsed.seniorProviderClass;
      const firmType = plan.parsed.investorFirmType;
      return {
        hubId: h.hubId,
        hubName: h.name,
        sourceFamily: fam?.datasetName ?? h.preview?.sourceFamily ?? 'See specialist methodology',
        queryGrain: h.preview?.grain ?? h.whatItCanAnswer,
        geographyMeaning: h.geographyCapability,
        officialAsOf: h.preview?.officialAsOf ?? fam?.officialAsOf ?? 'See specialist page',
        identifier:
          (h.hubId === 'insurance' || h.hubId === 'move') &&
          plan.parsed.identifier &&
          !plan.parsed.identifier.ambiguous
            ? plan.parsed.identifier.raw
            : undefined,
        specialistDestination: h.destination ?? capabilityFor(h.hubId).origin,
        contract:
          h.hubId === 'senior'
            ? SENIOR_ASK_CONTRACT
            : h.hubId === 'investor'
              ? INVESTOR_ASK_CONTRACT
              : h.hubId === 'insurance'
                ? INSURANCE_ASK_CONTRACT
                : h.hubId === 'move'
                  ? MOVE_ASK_CONTRACT
                  : h.hubId === 'lender'
                    ? h.capabilityStatus === 'execute'
                      ? LENDER_ASK_CONTRACT
                      : undefined
                    : capabilityFor(h.hubId).askContract,
        providerClass:
          h.hubId === 'senior'
            ? cls
              ? SENIOR_PROVIDER_CLASS_LABEL[cls]
              : undefined
            : h.hubId === 'investor'
              ? firmType
                ? INVESTOR_FIRM_TYPE_LABEL[firmType]
                : undefined
              : h.hubId === 'insurance'
                ? plan.parsed.insuranceEntityClass
                  ? INSURANCE_ENTITY_CLASS_LABEL[plan.parsed.insuranceEntityClass]
                  : undefined
                : h.hubId === 'move'
                  ? plan.parsed.moveRegulatoryRole
                    ? MOVE_ROLE_LABEL[plan.parsed.moveRegulatoryRole]
                    : undefined
                : undefined,
      };
    });
}

export function assembleNetworkAnswer(query: string): NetworkAskAnswer {
  const overallStarted = Date.now();
  const plan = buildNetworkAskPlan(query);
  const traces = tracesForPlan(plan);

  const n = plan.hubs.filter((h) => h.capabilityStatus !== 'unsupported').length;
  const hubCountLabel =
    n <= 1 ? '' : `Your question touches ${n} TrustHub research systems`;

  const primary = plan.hubs.length === 1 ? plan.hubs[0] : undefined;
  const specificIdentity = isSpecificIdentityRequest(plan.parsed);
  const resultClass: AskResultClass = /\b(one|universal|single|combined)\s+(trust\s+)?score\b/i.test(plan.query)
    ? 'UNSUPPORTED_QUERY'
    : plan.parsed.identifier?.ambiguous
    ? 'UNSUPPORTED_QUERY'
    : plan.hubs.length > 1 && plan.intent === 'journey'
      ? 'HANDOFF'
      : plan.intent === 'place'
        ? 'MARKET_OR_PLACE_RESEARCH'
        : specificIdentity && plan.parsed.identifier
          ? 'EXACT_IDENTITY'
          : specificIdentity
            ? 'HANDOFF'
            : plan.hubs.length === 0
              ? 'UNSUPPORTED_QUERY'
              : 'RESEARCH_COHORT';
  const identityResolutionClass = plan.parsed.identifier && !plan.parsed.identifier.ambiguous ? 'EXACT_IDENTIFIER' as const : undefined;
  const params = new URLSearchParams({ q: plan.query });
  return {
    plan,
    interpretation: plan.parsed.interpretationLines,
    hubCountLabel,
    traces,
    changeHref: `/ask?${params.toString()}#interpretation`,
    options: primary?.options,
    judgmentNote: primary?.judgmentNote,
    followUp: primary?.followUp,
    matchWhy: primary?.matchWhy,
    limitation: primary?.preview?.limitation ?? primary?.whatItCanAnswer,
    compareHref: primary?.compareHref,
    resultClass,
    identityResolutionClass,
    diagnostics: {
      interpretedIntent: plan.intent,
      selectedHubs: plan.hubs.map((hub) => hub.hubId),
      resultClass,
      identityResolutionClass,
      capabilityUsed: plan.hubs.map((hub) => `${hub.hubId}:${hub.mode ?? hub.capabilityStatus}`),
      fallbackPath: plan.hubs.length ? 'specialist_handoff' : 'unsupported',
      resultCount: primary?.options?.length ?? 0,
      sourceContract: traces.map((row) => row.contract).filter((value): value is string => Boolean(value)),
      parserLatencyMs: 0,
      routingLatencyMs: plan.routingMs,
      resolverLatencyMs: 0,
      overallLatencyMs: Date.now() - overallStarted,
    },
  };
}

function destinationContext(answer: NetworkAskAnswer): { originalQuery: string; searchQuery?: string; geography?: string } {
  const hub = answer.plan.hubs[0];
  return {
    originalQuery: answer.plan.query,
    searchQuery: hub?.searchQuery,
    geography: answer.plan.parsed.geography?.stateCode ?? answer.plan.parsed.geography?.countySlug,
  };
}

function consumerOverlay(answer: NetworkAskAnswer): NetworkAskAnswer {
  const primary = answer.plan.hubs.length === 1 ? answer.plan.hubs[0] : undefined;
  if (!primary) return answer;
  return {
    ...answer,
    options: primary.options,
    judgmentNote: primary.judgmentNote,
    followUp: primary.followUp,
    matchWhy: primary.matchWhy ?? primary.options?.[0]?.whyMatched,
    limitation: primary.preview?.limitation ?? primary.whatItCanAnswer,
    compareHref: primary.compareHref,
  };
}

function applySeniorPayload(answer: NetworkAskAnswer, payload: SeniorAskPayload): NetworkAskAnswer {
  const senior = answer.plan.hubs.find((h) => h.hubId === 'senior');
  if (!senior) return answer;
  const failReason = payload.failClosed?.reason ?? (payload.resultType === 'fail_closed' ? payload.query?.failReason : undefined);
  const officialAsOf = payload.provenance?.officialAsOf ?? senior.preview?.officialAsOf ?? 'See specialist result';
  const sourceFamily = payload.provenance?.sourceFamily ?? senior.preview?.sourceFamily ?? 'cms-care-compare';
  const geography = payload.provenance?.geographyMeaning ?? payload.query?.geography?.meaning ?? senior.geographyCapability;
  const grain = payload.provenance?.queryGrain ?? senior.preview?.grain ?? senior.mode;
  const providerClass = payload.provenance?.providerClass ?? senior.structuredFilters?.providerClass;

  senior.preview = {
    headline: failReason ?? senior.preview?.headline ?? 'Open SeniorTrustHub structured Ask.',
    grain: grain ?? 'senior-ask-v1',
    limitation: failReason
      ? (payload.failClosed?.alternatives?.join(' ') ?? failReason)
      : (payload.limitations?.[0] ?? senior.preview?.limitation ?? 'Specialist result is authoritative.'),
    officialAsOf: officialAsOf || 'See specialist result',
    sourceFamily,
  };
  senior.geographyCapability = geography;
  if (failReason && senior.failKind !== 'soft') {
    senior.mode = 'fail_closed';
    senior.whatItCanAnswer = failReason;
  }
  const seniorOptions = optionsFromSeniorPayload(payload, 10, destinationContext(answer));
  if (seniorOptions.length) senior.options = seniorOptions;

  const traces = tracesForPlan(answer.plan).map((row) =>
    row.hubId === 'senior'
      ? {
          ...row,
          sourceFamily,
          queryGrain: grain ?? row.queryGrain,
          geographyMeaning: geography,
          officialAsOf: officialAsOf || row.officialAsOf,
          contract: SENIOR_ASK_CONTRACT,
          providerClass: typeof providerClass === 'string' ? providerClass : row.providerClass,
          specialistDestination: senior.destination ?? row.specialistDestination,
        }
      : row
  );

  return consumerOverlay({ ...answer, traces });
}

function applyInvestorPayload(answer: NetworkAskAnswer, payload: InvestorAskPayload): NetworkAskAnswer {
  const investor = answer.plan.hubs.find((h) => h.hubId === 'investor');
  if (!investor) return answer;
  const failReason = payload.query?.failReason ?? (payload.resultType === 'fail_closed' ? payload.query?.failReason : undefined);
  const officialAsOf = payload.provenance?.officialAsOf ?? investor.preview?.officialAsOf ?? 'See specialist result';
  const sourceFamily = payload.provenance?.sourceFamily ?? investor.preview?.sourceFamily ?? 'sec-iard-adv';
  const geography = payload.provenance?.geographyMeaning ?? payload.query?.geography?.meaning ?? investor.geographyCapability;
  const grain = payload.provenance?.metric ?? investor.preview?.grain ?? investor.mode;

  investor.preview = {
    headline: failReason ?? investor.preview?.headline ?? 'Open InvestorTrustHub structured Ask.',
    grain: grain ?? 'investor-ask-v1',
    limitation: failReason ?? payload.limitations?.[0] ?? investor.preview?.limitation ?? 'Specialist result is authoritative.',
    officialAsOf: officialAsOf || 'See specialist result',
    sourceFamily,
  };
  investor.geographyCapability = geography;
  if (failReason && investor.failKind !== 'soft') {
    investor.mode = 'fail_closed';
    investor.whatItCanAnswer = failReason;
  }
  const investorOptions = optionsFromInvestorPayload(payload, 10, destinationContext(answer));
  if (investorOptions.length) investor.options = investorOptions;

  const traces = tracesForPlan(answer.plan).map((row) =>
    row.hubId === 'investor'
      ? {
          ...row,
          sourceFamily,
          queryGrain: grain ?? row.queryGrain,
          geographyMeaning: geography,
          officialAsOf: officialAsOf || row.officialAsOf,
          contract: INVESTOR_ASK_CONTRACT,
          specialistDestination: investor.destination ?? row.specialistDestination,
        }
      : row
  );
  return consumerOverlay({ ...answer, traces });
}

function applyInsurancePayload(answer: NetworkAskAnswer, payload: InsuranceAskPayload): NetworkAskAnswer {
  const insurance = answer.plan.hubs.find((h) => h.hubId === 'insurance');
  if (!insurance) return answer;
  const failReason =
    payload.query?.failReason ?? (payload.resultType === 'fail_closed' ? payload.query?.failReason : undefined);
  const officialAsOf = payload.provenance?.officialAsOf ?? insurance.preview?.officialAsOf ?? 'See specialist result';
  const sourceFamily = payload.provenance?.sourceFamily ?? insurance.preview?.sourceFamily ?? 'state-doi';
  const geography =
    payload.provenance?.geographyMeaning ?? payload.query?.jurisdiction?.meaning ?? insurance.geographyCapability;
  const grain = payload.provenance?.grain ?? insurance.preview?.grain ?? insurance.mode;
  const emptyExecuted =
    !failReason &&
    (payload.resultType === 'entity' || payload.resultType === 'identifier' || payload.resultType === 'evidence') &&
    !(payload.results && payload.results.length) &&
    !(payload.counts && payload.counts[0]?.value);
  const countValue = payload.counts?.[0]?.value ?? payload.pagination?.total;
  const dataLimitation =
    emptyExecuted
      ? payload.limitations?.[0] ??
        'Specialist executed. Current indexed result set is empty. Empty is not a finding that authority does not exist.'
      : payload.limitations?.[0];

  insurance.preview = {
    headline: failReason
      ? failReason
      : emptyExecuted
        ? (dataLimitation ??
          'Specialist executed. Current indexed result set is empty. Empty is not a finding that authority does not exist.')
        : countValue
          ? `Specialist count: ${countValue.toLocaleString('en-US')} (${grain ?? 'canonical identities'})`
          : insurance.preview?.headline ?? 'Open InsuranceTrustHub structured Ask.',
    grain: grain ?? 'insurance-ask-v1',
    limitation: failReason ?? dataLimitation ?? insurance.preview?.limitation ?? 'Specialist result is authoritative.',
    officialAsOf: officialAsOf || 'See specialist result',
    sourceFamily,
  };
  insurance.geographyCapability = geography;
  if (failReason && insurance.failKind !== 'soft') {
    insurance.mode = 'fail_closed';
    insurance.whatItCanAnswer = failReason;
  } else if (payload.query?.mode && insurance.failKind !== 'soft') {
    insurance.mode = payload.query.mode;
  }
  insurance.capabilityStatus = 'execute';
  const insuranceOptions = optionsFromInsurancePayload(payload, 10, destinationContext(answer));
  if (insuranceOptions.length) insurance.options = insuranceOptions;

  const traces = tracesForPlan(answer.plan).map((row) =>
    row.hubId === 'insurance'
      ? {
          ...row,
          sourceFamily,
          queryGrain: grain ?? row.queryGrain,
          geographyMeaning: geography,
          officialAsOf: officialAsOf || row.officialAsOf,
          contract: INSURANCE_ASK_CONTRACT,
          providerClass:
            typeof payload.entityClass === 'string'
              ? payload.entityClass === 'person'
                ? 'Producer / individual'
                : payload.entityClass === 'insurer'
                  ? 'Legal insurer'
                  : payload.entityClass === 'agency'
                    ? 'Agency'
                    : row.providerClass
              : row.providerClass,
          specialistDestination: insurance.destination ?? row.specialistDestination,
        }
      : row,
  );
  return consumerOverlay({ ...answer, traces });
}

export function applyMovePayload(answer: NetworkAskAnswer, payload: MoveAskPayload): NetworkAskAnswer {
  const move = answer.plan.hubs.find((h) => h.hubId === 'move');
  if (!move) return answer;
  const failReason =
    payload.query?.failReason ?? (payload.resultType === 'fail_closed' ? payload.query?.failReason : undefined);
  const officialAsOf = payload.provenance?.officialAsOf ?? move.preview?.officialAsOf ?? 'See specialist result';
  const sourceFamily = payload.provenance?.sourceFamily ?? move.preview?.sourceFamily ?? 'fmcsa-directory-cohort';
  const geography =
    payload.provenance?.geographyMeaning ?? payload.query?.jurisdiction?.meaning ?? move.geographyCapability;
  const grain = payload.provenance?.grain ?? move.preview?.grain ?? move.mode;
  const resolver = (payload as MoveAskPayload & { identityResolution?: { class?: IdentityResolutionClass } }).identityResolution;
  if (isSpecificIdentityRequest(answer.plan.parsed) && !answer.plan.parsed.identifier && !resolver) {
    const requestedName = requestedIdentityName(answer.plan.parsed);
    move.options = undefined;
    move.mode = 'fail_closed';
    move.failKind = 'hard';
    move.whatItCanAnswer = 'No unrelated movers were substituted for the company name you entered.';
    move.preview = {
      headline: `We couldn't find a confident published identity matching “${requestedName}.”`,
      grain: 'specific_company_identity',
      limitation: 'The current specialist contract returned a research cohort, not a canonical name-resolution result. Ask discarded that cohort.',
      officialAsOf,
      sourceFamily,
    };
    return {
      ...consumerOverlay(answer),
      options: undefined,
      resultClass: 'NO_CONFIDENT_MATCH',
      identityResolutionClass: 'NO_CONFIDENT_MATCH',
      noResult: {
        headline: move.preview.headline,
        understood: `Ask understood this as a search for the specific company “${requestedName},” not a market list.`,
        actions: ['Try the legal company name', 'Search a USDOT or MC number', 'Continue on MoveTrustHub Search'],
      },
      diagnostics: { ...answer.diagnostics, resultClass: 'NO_CONFIDENT_MATCH', identityResolutionClass: 'NO_CONFIDENT_MATCH', fallbackPath: 'identity_cohort_firewall', resultCount: 0 },
    };
  }
  const emptyExecuted =
    !failReason &&
    (payload.resultType === 'entity' || payload.resultType === 'identifier' || payload.resultType === 'evidence') &&
    !(payload.results && payload.results.length) &&
    !(payload.counts && payload.counts[0]?.value);
  const countValue = payload.counts?.[0]?.value ?? payload.pagination?.total;
  const firstName = payload.results?.[0]?.name;
  const dataLimitation = emptyExecuted
    ? payload.limitations?.[0] ??
      'Specialist executed. Current indexed result set is empty. Absence is not inactive, unauthorized, or a clean record.'
    : payload.limitations?.[0];

  move.preview = {
    headline: failReason
      ? failReason
      : emptyExecuted
        ? (dataLimitation ?? 'Specialist executed. Current indexed result set is empty.')
        : countValue
          ? `Specialist count: ${countValue.toLocaleString('en-US')} (${grain ?? 'research identities'})`
          : firstName
            ? `${firstName}${payload.results?.[0]?.role ? ` · ${payload.results[0].role}` : ''}`
            : move.preview?.headline ?? 'Open MoveTrustHub structured Ask.',
    grain: grain ?? 'move-ask-v1',
    limitation: failReason ?? dataLimitation ?? move.preview?.limitation ?? 'Specialist result is authoritative.',
    officialAsOf: officialAsOf || 'See specialist result',
    sourceFamily,
  };
  move.geographyCapability = geography;
  if (failReason && move.failKind !== 'soft') {
    move.mode = 'fail_closed';
    move.whatItCanAnswer = failReason;
  } else if (payload.query?.mode && move.failKind !== 'soft') {
    move.mode = payload.query.mode;
  }
  move.capabilityStatus = 'execute';
  const moveOptions = optionsFromMovePayload(payload, 10, destinationContext(answer));
  if (moveOptions.length) move.options = moveOptions;
  if (resolver?.class === 'FUZZY_CANDIDATES' || resolver?.class === 'NO_CONFIDENT_MATCH') move.options = undefined;

  const traces = tracesForPlan(answer.plan).map((row) =>
    row.hubId === 'move'
      ? {
          ...row,
          sourceFamily,
          queryGrain: grain ?? row.queryGrain,
          geographyMeaning: geography,
          officialAsOf: officialAsOf || row.officialAsOf,
          contract: MOVE_ASK_CONTRACT,
          providerClass: payload.results?.[0]?.role ?? row.providerClass,
          identifier:
            payload.query?.identifier
              ? `${(payload.query.identifier.type ?? '').toUpperCase()} ${payload.query.identifier.value ?? ''}`.trim()
              : row.identifier,
          specialistDestination: move.destination ?? row.specialistDestination,
        }
      : row,
  );
  const overlaid = consumerOverlay({ ...answer, traces });
  const resultClass: AskResultClass = answer.plan.parsed.identifier
    ? 'EXACT_IDENTITY'
    : resolver?.class === 'AMBIGUOUS_NAME'
      ? 'AMBIGUOUS_IDENTITIES'
      : resolver?.class === 'FUZZY_CANDIDATES' || resolver?.class === 'NO_CONFIDENT_MATCH'
        ? 'NO_CONFIDENT_MATCH'
        : resolver
          ? 'EXACT_IDENTITY'
          : 'RESEARCH_COHORT';
  return { ...overlaid, options: move.options, resultClass, identityResolutionClass: resolver?.class ?? answer.identityResolutionClass, diagnostics: { ...answer.diagnostics, resultClass, identityResolutionClass: resolver?.class ?? answer.identityResolutionClass, resultCount: move.options?.length ?? 0, fallbackPath: 'none' } };
}

function applyLenderPayload(answer: NetworkAskAnswer, payload: LenderAskPayload): NetworkAskAnswer {
  const lender = answer.plan.hubs.find((h) => h.hubId === 'lender');
  if (!lender) return answer;
  const failReason =
    payload.query?.failReason ??
    (payload.failClosed ? payload.headline ?? payload.query?.failClosedKind : undefined);
  const officialAsOf = payload.period ?? payload.trace?.period ?? lender.preview?.officialAsOf ?? 'See specialist result';
  const sourceFamily = /\bcfpb|complaint/i.test(answer.plan.query)
    ? 'cfpb-complaints'
    : lender.preview?.sourceFamily ?? 'hmda';
  const geography =
    payload.geographyWarning ?? payload.query?.geography?.note ?? lender.geographyCapability;
  const grain = payload.grain ?? payload.trace?.grain ?? lender.preview?.grain ?? lender.mode;
  const first = payload.rows?.[0];
  const emptyExecuted = !failReason && !(payload.rows && payload.rows.length) && !(payload.facts && payload.facts.length);
  const dataLimitation = emptyExecuted
    ? payload.caveats?.[0] ??
      'Specialist executed. Current indexed result set is empty. Absence is not a clean record or a ranking.'
    : payload.caveats?.[0];

  lender.preview = {
    headline: failReason
      ? failReason
      : emptyExecuted
        ? (dataLimitation ?? 'Specialist executed. Current indexed result set is empty.')
        : payload.headline
          ? payload.headline
          : first
            ? `${first.displayName ?? 'Lender'}${typeof first.metric === 'number' ? ` · ${first.metric.toLocaleString('en-US')}` : ''}`
            : lender.preview?.headline ?? 'Open LenderTrustHub structured Ask.',
    grain: grain ?? 'lender-ask-v1',
    limitation: failReason ?? dataLimitation ?? lender.preview?.limitation ?? 'Specialist result is authoritative.',
    officialAsOf: officialAsOf || 'See specialist result',
    sourceFamily,
  };
  lender.geographyCapability = geography;
  if ((failReason || payload.failClosed) && lender.failKind !== 'soft') {
    lender.mode = 'fail_closed';
    lender.whatItCanAnswer = failReason ?? payload.headline ?? lender.whatItCanAnswer;
  } else if (payload.query?.mode && lender.failKind !== 'soft') {
    lender.mode = payload.query.mode;
  }
  lender.capabilityStatus = 'execute';
  const lenderOptions = optionsFromLenderPayload(payload, 10, destinationContext(answer));
  if (lenderOptions.length) lender.options = lenderOptions;

  const traces = tracesForPlan(answer.plan).map((row) =>
    row.hubId === 'lender'
      ? {
          ...row,
          sourceFamily,
          queryGrain: grain ?? row.queryGrain,
          geographyMeaning: geography,
          officialAsOf: officialAsOf || row.officialAsOf,
          contract: LENDER_ASK_CONTRACT,
          specialistDestination: lender.destination ?? row.specialistDestination,
        }
      : row,
  );
  return consumerOverlay({ ...answer, traces });
}

/** Runtime overlay: read live specialist JSON contracts without changing routing. */
export async function assembleNetworkAnswerWithSpecialist(query: string): Promise<NetworkAskAnswer> {
  const overallStarted = Date.now();
  let resolverLatencyMs = 0;
  let answer = assembleNetworkAnswer(query);
  const live = (hubId: SpecialistHubId) => {
    const hub = answer.plan.hubs.find((h) => h.hubId === hubId && h.capabilityStatus === 'execute');
    if (!hub || hub.failKind === 'hard') return undefined;
    return hub;
  };
  const qFor = (hub: { searchQuery?: string }) => hub.searchQuery ?? query;
  const timed = async <T,>(operation: () => Promise<T>): Promise<T> => {
    const started = Date.now();
    try { return await operation(); } finally { resolverLatencyMs += Date.now() - started; }
  };

  const senior = live('senior');
  if (senior) {
    const payload = await timed(() => fetchSeniorAsk(qFor(senior)));
    if (payload) answer = applySeniorPayload(answer, payload);
  }
  const investor = live('investor');
  if (investor) {
    const payload = await timed(() => fetchInvestorAsk(qFor(investor)));
    if (payload) answer = applyInvestorPayload(answer, payload);
  }
  const insurance = live('insurance');
  if (insurance) {
    const payload = await timed(() => fetchInsuranceAsk(qFor(insurance)));
    if (payload) answer = applyInsurancePayload(answer, payload);
  }
  const move = live('move');
  if (move) {
    const payload = await timed(() => fetchMoveAsk(qFor(move)));
    if (payload) answer = applyMovePayload(answer, payload);
  }
  const lender = live('lender');
  if (lender) {
    const payload = await timed(() => fetchLenderAsk(qFor(lender)));
    if (payload) answer = applyLenderPayload(answer, payload);
  }
  const contractor = live('contractor');
  if (contractor) {
    const options = await timed(() => fetchContractorAskOptions(answer.plan.parsed, qFor(contractor), 8000, destinationContext(answer)));
    if (options?.length) {
      contractor.options = options;
      answer = consumerOverlay(answer);
    }
  }
  return { ...answer, diagnostics: { ...answer.diagnostics, resolverLatencyMs, overallLatencyMs: Date.now() - overallStarted } };
}
