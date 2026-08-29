import { capabilityFor } from './capability-registry.ts';
import { parseNetworkAsk, type ParsedNetworkAsk } from './ask-parse.ts';
import { compareBrowardPalmBeach } from './place-comparison.ts';
import { browardPlaceLens, floridaPlaceLens, palmBeachPlaceLens, type PlaceLens } from './place-lens.ts';
import { listNetworkSourceRows } from './source-registry.ts';
import { NETWORK_PUBLIC_NAMES, type SpecialistHubId } from './registry.ts';
import { runNameCheck, type NameCheckResult } from './name-check.ts';
import { IDENTIFIER_FAMILIES } from './identifiers.ts';

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

function hubPlan(hubId: SpecialistHubId, parsed: ParsedNetworkAsk): NetworkAskHubPlan {
  const cap = capabilityFor(hubId);
  const name = NETWORK_PUBLIC_NAMES[hubId];
  const lens = lensFor(parsed);
  const card = lens?.hubs.find((h) => h.hubId === hubId);

  if (parsed.intent === 'identifier' && parsed.identifier) {
    if (parsed.identifier.ambiguous) {
      return {
        hubId,
        name,
        capabilityStatus: 'unsupported',
        reason: collidingNote(),
        whatItCanAnswer: 'Ask will not auto-select a hub from bare digits.',
        geographyCapability: 'n/a',
      };
    }
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

export function assembleNetworkAnswer(query: string): NetworkAskAnswer {
  const plan = buildNetworkAskPlan(query);
  const sources = listNetworkSourceRows();
  const traces: TraceRow[] = plan.hubs
    .filter((h) => h.capabilityStatus !== 'unsupported')
    .map((h) => {
      const famId = h.preview?.sourceFamily;
      const fam = sources.find((s) => s.hubId === h.hubId && (!famId || s.id === famId)) ?? sources.find((s) => s.hubId === h.hubId);
      return {
        hubId: h.hubId,
        hubName: h.name,
        sourceFamily: fam?.datasetName ?? h.preview?.sourceFamily ?? 'See specialist methodology',
        queryGrain: h.preview?.grain ?? h.whatItCanAnswer,
        geographyMeaning: h.geographyCapability,
        officialAsOf: h.preview?.officialAsOf ?? fam?.officialAsOf ?? 'See specialist page',
        specialistDestination: h.destination ?? capabilityFor(h.hubId).origin,
      };
    });

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
