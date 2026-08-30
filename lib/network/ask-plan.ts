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
};

export type NetworkAskAnswer = {
  plan: NetworkAskPlan;
  interpretation: ParsedNetworkAsk['interpretationLines'];
  hubCountLabel: string;
  traces: TraceRow[];
  changeHref: string;
};

function contractorAskUrl(parsed: ParsedNetworkAsk): string {
  const params = new URLSearchParams();
  params.set('q', parsed.query);
  if (parsed.geography?.countySlug === 'broward') params.set('geo', 'broward');
  if (parsed.geography?.countySlug === 'palm-beach') params.set('geo', 'palm-beach');
  if (parsed.trade?.toLowerCase() === 'roofing') params.set('trade', 'roofing');
  if (parsed.credentialStatus) params.set('status', 'active_current');
  return `https://www.contractortrusthub.com/ask?${params.toString()}`;
}

function identifierDestination(parsed: ParsedNetworkAsk): string | undefined {
  const id = parsed.identifier;
  if (!id || id.ambiguous) return undefined;
  if (!id.family.live) return id.family.destinationHint;
  if (id.family.id === 'usdot' || id.family.id === 'mc') {
    return `https://www.movetrusthub.com/verify-dot`;
  }
  if (id.family.id === 'state_contractor_license') {
    return `https://www.contractortrusthub.com/verify?q=${encodeURIComponent(id.raw)}`;
  }
  if (id.family.id === 'crd') {
    return `https://www.investortrusthub.com/firms?q=${encodeURIComponent(id.raw)}`;
  }
  if (id.family.id === 'cms_ccn') {
    return seniorAskUrl(parsed.query);
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
    const browardRoof = parsed.geography?.countySlug === 'broward' && parsed.trade === 'Roofing';
    return {
      hubId,
      name,
      capabilityStatus: 'execute',
      mode: 'entity',
      structuredFilters: {
        geo: parsed.geography?.countySlug,
        trade: parsed.trade?.toLowerCase(),
        status: parsed.credentialStatus ? 'active_current' : undefined,
      },
      destination: dest,
      reason: 'ContractorTrustHub structured Ask is production-live. Parent constructs the Ask URL; it does not query the contractor database.',
      whatItCanAnswer: 'Indexed licensing records by geography, trade, and credential status.',
      geographyCapability: parsed.geography?.meaning ?? 'State/county as recorded on the credential — not service territory.',
      preview: browardRoof
        ? {
            headline: 'ContractorTrustHub published 924 active Broward roofing credentials on its county intelligence page.',
            grain: 'Certified CCC + registered RC with mailing/base county Broward. Credential records, not companies, not “trusted roofers.”',
            limitation: 'Open structured Ask for the live query. Ask does not rewrite 924 as a recommendation.',
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

  if (hubId === 'lender' && parsed.intent === 'market') {
    return {
      hubId,
      name,
      capabilityStatus: 'handoff',
      mode: 'market',
      destination: parsed.geography?.stateCode === 'FL' ? 'https://www.lendertrusthub.com/florida' : 'https://www.lendertrusthub.com',
      reason: 'LenderTrustHub Ask is not production-live. Do not fabricate FHA origination rankings from branch-only work.',
      whatItCanAnswer: 'Florida mortgage intelligence and national HMDA activity on the specialist hub — not a federated FHA ranking.',
      geographyCapability: 'HMDA property geography is not lender headquarters.',
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
  return 'Bare digits can mean USDOT, NMLS, CCN, or CRD. Ask must preserve ambiguity and not auto-select a hub from digits alone.';
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
    comparison = compareBrowardPalmBeach();
    hubs = comparison.hubs.map((h) =>
      hubPlan(h.hubId, parsed)
    );
  } else if (parsed.suggestedHubs.length) {
    hubs = parsed.suggestedHubs.map((id) => hubPlan(id, parsed));
  } else if (parsed.identifier?.ambiguous) {
    hubs = IDENTIFIER_FAMILIES.filter((f) => ['usdot', 'nmls', 'cms_ccn', 'crd'].includes(f.id)).map((f) => ({
      hubId: f.hubId,
      name: NETWORK_PUBLIC_NAMES[f.hubId],
      capabilityStatus: 'unsupported' as const,
      reason: collidingNote(),
      whatItCanAnswer: f.label,
      geographyCapability: 'n/a',
    }));
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
      return {
        hubId: h.hubId,
        hubName: h.name,
        sourceFamily: fam?.datasetName ?? h.preview?.sourceFamily ?? 'See specialist methodology',
        queryGrain: h.preview?.grain ?? h.whatItCanAnswer,
        geographyMeaning: h.geographyCapability,
        officialAsOf: h.preview?.officialAsOf ?? fam?.officialAsOf ?? 'See specialist page',
        specialistDestination: h.destination ?? capabilityFor(h.hubId).origin,
        contract: h.hubId === 'senior' ? SENIOR_ASK_CONTRACT : capabilityFor(h.hubId).askContract,
        providerClass: h.hubId === 'senior' ? (cls ? SENIOR_PROVIDER_CLASS_LABEL[cls] : undefined) : undefined,
      };
    });
}

export function assembleNetworkAnswer(query: string): NetworkAskAnswer {
  const plan = buildNetworkAskPlan(query);
  const traces = tracesForPlan(plan);

  const n = plan.hubs.filter((h) => h.capabilityStatus !== 'unsupported').length;
  const hubCountLabel =
    n <= 1 ? '' : `Your question touches ${n} TrustHub research systems`;

  const params = new URLSearchParams({ q: plan.query });
  return {
    plan,
    interpretation: plan.parsed.interpretationLines,
    hubCountLabel,
    traces,
    changeHref: `/ask?${params.toString()}#interpretation`,
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
  if (failReason) {
    senior.mode = 'fail_closed';
    senior.whatItCanAnswer = failReason;
  }

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

  return { ...answer, traces };
}

/** Runtime overlay: read Senior's public JSON contract without changing routing. */
export async function assembleNetworkAnswerWithSpecialist(query: string): Promise<NetworkAskAnswer> {
  const answer = assembleNetworkAnswer(query);
  const senior = answer.plan.hubs.find((h) => h.hubId === 'senior' && h.capabilityStatus === 'execute');
  if (!senior) return answer;
  const payload = await fetchSeniorAsk(query);
  if (!payload) return answer;
  return applySeniorPayload(answer, payload);
}
