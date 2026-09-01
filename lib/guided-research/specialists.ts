import type { GuidedExecutionResult, GuidedRefinement, GuidedResearchSession, GuidedResultRow, GuidedResultState } from './contract.ts';

const ENDPOINTS = {
  move: process.env.MOVE_SPECIALIST_EXECUTION_URL ?? 'https://www.movetrusthub.com/api/specialist-execution/v2',
  senior: process.env.SENIOR_SPECIALIST_EXECUTION_URL ?? 'https://www.seniortrusthub.com/api/specialist-execution/v2',
  contractor: process.env.CONTRACTOR_SPECIALIST_EXECUTION_URL ?? 'https://www.contractortrusthub.com/api/specialist-execution/v2',
} as const;
export const SPECIALIST_EXECUTION_CONTRACT = 'trusthub-specialist-execution-v2';
export const SPECIALIST_TIMEOUT_MS = 5_000;

type FetchOutcome = { status: number; body: Record<string, unknown>; latencyMs: number } | { error: 'TIMEOUT' | 'BACKEND_UNAVAILABLE'; latencyMs: number };

async function specialistFetch(hub: keyof typeof ENDPOINTS, body: unknown): Promise<FetchOutcome> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SPECIALIST_TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINTS[hub], {
      method: 'POST', signal: controller.signal,
      headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'AskTrustHub-Guided-Research/1' },
      body: JSON.stringify(body), cache: 'no-store',
    });
    const parsed = await response.json().catch(() => ({}));
    return { status: response.status, body: parsed as Record<string, unknown>, latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    return { error: error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'BACKEND_UNAVAILABLE', latencyMs: Math.round(performance.now() - started) };
  } finally { clearTimeout(timer); }
}

function heading(state: GuidedResultState): string {
  return {
    SUPPORTED_RESULTS: 'Research results',
    ZERO_MATCHING_ROWS: 'No records match these exact filters',
    UNSUPPORTED_CAPABILITY: 'This specific research is not supported by the current public source',
    INVALID_QUERY: 'We need to correct part of this request',
    BACKEND_UNAVAILABLE: 'This specialist research system is temporarily unavailable',
    TIMEOUT: 'This research request took too long',
  }[state];
}

function failure(session: GuidedResearchSession, state: GuidedResultState, latencyMs: number, code: string, message?: string): GuidedExecutionResult {
  return {
    specialist: session.hub!, resultState: state, consumerHeading: heading(state),
    consumerMessage: message ?? (state === 'TIMEOUT' ? 'Retry, or continue directly with the specialist Trust Hub.' : 'The request was understood, but evidence could not be returned safely.'),
    interpretation: interpretation(session), rows: [], total: 0, refinements: [], provenance: { contract: SPECIALIST_EXECUTION_CONTRACT },
    limitations: [], destinations: [], error: { code, retryable: state === 'TIMEOUT' || state === 'BACKEND_UNAVAILABLE' },
    latencyMs, firstUsefulResult: state === 'UNSUPPORTED_CAPABILITY',
  };
}

function interpretation(session: GuidedResearchSession): Array<{ label: string; value: string }> {
  const rows = [{ label: 'Specialist', value: session.hub === 'senior' ? 'SeniorTrustHub' : session.hub === 'contractor' ? 'ContractorTrustHub' : 'MoveTrustHub' }];
  if (session.providerClass) rows.push({ label: 'Provider class', value: session.providerClass.replaceAll('_', ' ') });
  if (session.trade) rows.push({ label: 'Trade', value: session.trade });
  if (session.moveMode) rows.push({ label: 'Research class', value: session.moveMode.replaceAll('_', ' ') });
  if (session.regulatoryRole) rows.push({ label: 'Regulatory role', value: session.regulatoryRole });
  if (session.geography) rows.push({ label: 'Recorded geography', value: session.geography.value });
  return rows;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === 'object') as Record<string, unknown>[] : [];
}

function normalizeRefinements(value: unknown): GuidedRefinement[] {
  if (!Array.isArray(value)) return [];
  const result: GuidedRefinement[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      result.push({ id: item, label: item.replaceAll('_', ' '), values: [] });
      continue;
    }
    const row = record(item);
    const id = text(row.id) ?? text(row.field);
    if (!id) continue;
    const values = Array.isArray(row.values) ? row.values.filter((v): v is string => typeof v === 'string').slice(0, 30).map((v) => ({ value: v, label: v.replaceAll('_', ' ') })) : [];
    result.push({ id, label: id.replaceAll('_', ' '), values, meaning: text(row.meaning) });
  }
  return result.filter((row, index, all) => all.findIndex((other) => other.id === row.id) === index);
}

async function executeMove(session: GuidedResearchSession): Promise<GuidedExecutionResult> {
  const serviceIntent = /\bserv(?:e|es|ing)|\bfrom\s+.+\s+to\b|near me/i.test(session.originalQuestion);
  const body = session.identifier ? {
    contract: SPECIALIST_EXECUTION_CONTRACT, queryType: 'identifier',
    entityClass: 'mover', identifier: { type: /mc/i.test(session.identifier.type) ? 'MC' : 'USDOT', value: session.identifier.value }, limit: 10,
  } : session.identityName ? {
    contract: SPECIALIST_EXECUTION_CONTRACT, queryType: 'identity', entityClass: 'mover', identityName: session.identityName, limit: 10,
  } : {
    contract: SPECIALIST_EXECUTION_CONTRACT, queryType: 'cohort',
    entityClass: session.moveMode === 'auto_transport' ? 'auto_transport' : 'mover',
    role: session.regulatoryRole,
    geography: session.geography ? {
      stateCode: session.geography.stateCode ?? (session.geography.type === 'state' ? session.geography.value : undefined),
      stateName: session.geography.stateName,
      city: session.geography.city,
      intent: serviceIntent ? 'SERVICE_TERRITORY' : 'RECORDED_HQ',
    } : serviceIntent ? { stateName: 'New York', stateCode: 'NY', intent: 'SERVICE_TERRITORY' } : undefined,
    page: 1, limit: 10,
  };
  const outcome = await specialistFetch('move', body);
  if ('error' in outcome) return failure(session, outcome.error, outcome.latencyMs, outcome.error.toLowerCase());
  const payload = outcome.body;
  if (text(payload.contractVersion) !== SPECIALIST_EXECUTION_CONTRACT && text(payload.contract) !== SPECIALIST_EXECUTION_CONTRACT) return failure(session, 'BACKEND_UNAVAILABLE', outcome.latencyMs, 'contract_mismatch');
  const rawState = text(payload.resultType);
  const state: GuidedResultState = rawState && ['SUPPORTED_RESULTS','ZERO_MATCHING_ROWS','UNSUPPORTED_CAPABILITY','INVALID_QUERY','BACKEND_UNAVAILABLE','TIMEOUT'].includes(rawState) ? rawState as GuidedResultState : outcome.status >= 500 ? 'BACKEND_UNAVAILABLE' : outcome.status >= 400 ? 'INVALID_QUERY' : 'SUPPORTED_RESULTS';
  if (state !== 'SUPPORTED_RESULTS') {
    const result = failure(session, state, outcome.latencyMs, state.toLowerCase(), records(payload.limitations).length ? undefined : (Array.isArray(payload.limitations) ? String(payload.limitations[0] ?? '') : undefined));
    result.limitations = Array.isArray(payload.limitations) ? payload.limitations.filter((x): x is string => typeof x === 'string') : [];
    result.destinations = Object.entries(record(payload.destinations)).flatMap(([key, href]) => typeof href === 'string' ? [{ type: key === 'verifyDot' ? 'VERIFY' as const : 'DIRECTORY' as const, href, label: key === 'verifyDot' ? 'Verify USDOT or MC' : 'Research recorded headquarters' }] : []);
    if (state === 'UNSUPPORTED_CAPABILITY') result.consumerMessage = result.limitations[0] ?? 'MoveTrustHub can research identities and recorded headquarters, but not service territory or route availability.';
    return result;
  }
  const rows = records(payload.rows).map((row): GuidedResultRow => {
    const hq = record(row.recordedHq);
    const usdot = text(row.usdot); const mc = text(row.mc);
    return {
      name: text(row.publicDisplayName) ?? text(row.legalName) ?? 'Published mover identity', hub: 'move',
      identifier: usdot ? { label: 'USDOT', value: usdot } : mc ? { label: 'MC', value: mc } : undefined,
      classLabel: text(row.role), recordedLocation: text(hq.raw), status: text(row.authorityState), sourceDate: text(row.sourceLastChecked),
      whyShown: text(row.whyMatched) ?? 'Matched the source-owned MoveTrustHub execution filters.',
      destination: { type: 'PROFILE', href: text(row.canonicalProfileUrl)!, label: 'Open MoveTrustHub profile' },
      facts: [mc ? { label: 'MC', value: mc } : null, text(row.role) ? { label: 'Role', value: text(row.role)! } : null].filter(Boolean) as Array<{label:string;value:string}>,
    };
  }).filter((row) => Boolean(row.destination.href));
  return supported(session, payload, rows, outcome.latencyMs, normalizeRefinements(payload.availableRefinements));
}

async function executeSenior(session: GuidedResearchSession): Promise<GuidedExecutionResult> {
  const filters: Record<string, number[]> = {};
  for (const [key, value] of Object.entries(session.selectedFilters)) if (/Stars$/.test(key)) filters[key] = [Number(value)];
  const body = session.identifier ? { identifier: session.identifier.value, page: 1 } : {
    providerClass: session.providerClass, geography: session.geography ? { type: session.geography.type, value: session.geography.value } : undefined,
    filters: Object.keys(filters).length ? filters : undefined, page: 1,
  };
  const outcome = await specialistFetch('senior', body);
  if ('error' in outcome) return failure(session, outcome.error, outcome.latencyMs, outcome.error.toLowerCase());
  const payload = outcome.body;
  if (text(payload.contract) !== SPECIALIST_EXECUTION_CONTRACT) return failure(session, 'BACKEND_UNAVAILABLE', outcome.latencyMs, 'contract_mismatch');
  if (outcome.status === 422 || text(payload.status) === 'unsupported_capability') {
    const result = failure(session, 'UNSUPPORTED_CAPABILITY', outcome.latencyMs, text(payload.errorCode) ?? 'unsupported_capability', text(payload.message));
    result.limitations = [text(payload.limitation)].filter(Boolean) as string[];
    return result;
  }
  if (outcome.status >= 500) return failure(session, 'BACKEND_UNAVAILABLE', outcome.latencyMs, text(payload.errorCode) ?? 'execution_unavailable');
  if (outcome.status >= 400) return failure(session, 'INVALID_QUERY', outcome.latencyMs, text(payload.errorCode) ?? 'invalid_query', text(payload.message));
  const rows = records(payload.rows).map((row): GuidedResultRow => {
    const location = record(row.recordedLocation); const evidence = record(row.evidence); const ccn = text(row.cmsCcn);
    const facts = Object.entries(evidence).filter(([,v]) => typeof v === 'string' || typeof v === 'number').slice(0, 3).map(([k,v]) => ({ label: k.replaceAll('_',' '), value: String(v) }));
    return {
      name: text(row.name) ?? 'Published SeniorTrustHub identity', hub: 'senior',
      identifier: ccn ? { label: 'CMS CCN', value: ccn } : undefined, classLabel: text(row.providerClass),
      recordedLocation: [text(location.city), text(location.state), text(location.zip)].filter(Boolean).join(', '),
      status: text(row.status), whyShown: 'Matched the selected CMS provider class and recorded geography.',
      destination: { type: 'PROFILE', href: text(row.canonicalProfileUrl)!, label: 'Open SeniorTrustHub profile' }, facts,
    };
  }).filter((row) => Boolean(row.destination.href));
  return supported(session, payload, rows, outcome.latencyMs, seniorRefinements(session));
}

function seniorRefinements(session: GuidedResearchSession): GuidedRefinement[] {
  if (session.providerClass === 'nursing_home') return ['overallStars','staffingStars','inspectionStars'].map((id) => ({ id, label: id.replace('Stars',' rating'), values: [1,2,3,4,5].map((v) => ({ value:String(v), label:`${v} CMS stars` })), meaning: 'Source-native CMS measure; not a TrustHub ranking.' }));
  if (session.providerClass === 'home_health') return [{ id:'qpcStars', label:'Quality of Patient Care rating', values:[1,2,3,4,5].map((v)=>({value:String(v),label:`${v} CMS stars`})), meaning:'Source-native Home Health measure only.' }];
  return [];
}

async function executeContractor(session: GuidedResearchSession): Promise<GuidedExecutionResult> {
  const body = {
    trade: session.trade, state: 'FL',
    county: session.geography?.county ?? (session.geography?.type === 'county' ? session.geography.value : undefined),
    city: session.geography?.city ?? (session.geography?.type === 'city' ? session.geography.value : undefined),
    credentialStatus: session.selectedFilters.credentialStatus ?? 'active_current', page: 1, limit: 10,
  };
  const outcome = await specialistFetch('contractor', body);
  if ('error' in outcome) return failure(session, outcome.error, outcome.latencyMs, outcome.error.toLowerCase());
  const payload = outcome.body;
  if (text(payload.contract) !== SPECIALIST_EXECUTION_CONTRACT) return failure(session, 'BACKEND_UNAVAILABLE', outcome.latencyMs, 'contract_mismatch');
  if (outcome.status === 422 || text(payload.status) === 'unsupported_capability') {
    const result = failure(session, 'UNSUPPORTED_CAPABILITY', outcome.latencyMs, text(payload.errorCode) ?? 'unsupported_capability',
      text(payload.errorCode) === 'unsupported_florida_electrical_source'
        ? 'We understood that you are looking for Florida electrical-contractor research in Boca Raton. The current accepted Florida construction source used by ContractorTrustHub does not include Florida electrical credentials.'
        : undefined);
    result.limitations = [text(payload.limitation)].filter(Boolean) as string[];
    result.destinations = records(payload.supportedAlternatives).flatMap((row) => text(row.destination) ? [{ type:'VERIFY' as const, href:text(row.destination)!, label:text(row.label) ?? 'Continue with the official source' }] : []);
    return result;
  }
  if (outcome.status >= 500) return failure(session, 'BACKEND_UNAVAILABLE', outcome.latencyMs, 'execution_unavailable');
  if (outcome.status >= 400) return failure(session, 'INVALID_QUERY', outcome.latencyMs, text(payload.error) ?? 'invalid_query');
  const rows = records(payload.rows).map((row): GuidedResultRow => {
    const geo=record(row.recordedGeography); const source=record(row.source); const credential=text(row.credentialNumber);
    return {
      name:text(row.name) ?? 'Published credential holder',hub:'contractor',identifier:credential?{label:'Credential',value:credential}:undefined,
      classLabel:text(row.trade),recordedLocation:[text(geo.city),text(geo.county),text(geo.state)].filter(Boolean).join(', '),
      status:text(row.status),sourceDate:text(source.observedAt),whyShown:'Matched the selected Florida DBPR trade, status, and recorded-geography filters.',
      destination:{type:'PROFILE',href:text(row.destination)!,label:'Open ContractorTrustHub profile'},
      facts:[text(row.occupationCode)?{label:'Occupation code',value:text(row.occupationCode)!}:null].filter(Boolean) as Array<{label:string;value:string}>,
    };
  }).filter((row)=>Boolean(row.destination.href));
  return supported(session,payload,rows,outcome.latencyMs,normalizeRefinements(payload.availableRefinements));
}

function supported(session: GuidedResearchSession, payload: Record<string, unknown>, rows: GuidedResultRow[], latencyMs: number, refinements: GuidedRefinement[]): GuidedExecutionResult {
  const total = Number(payload.total ?? rows.length);
  const state: GuidedResultState = total === 0 ? 'ZERO_MATCHING_ROWS' : 'SUPPORTED_RESULTS';
  const pagination=record(payload.pagination); const provenance=record(payload.provenance);
  return {
    specialist:session.hub!,resultState:state,consumerHeading:heading(state),
    consumerMessage:state==='SUPPORTED_RESULTS'?`${total.toLocaleString('en-US')} public records match these source-owned filters. Source order only — not a ranking.`:'The specialist executed the supported filters and returned zero matching public records.',
    interpretation:interpretation(session),rows,total,
    pagination:{page:Number(pagination.page??1),limit:Number(pagination.limit??pagination.pageSize??10),hasMore:Boolean(pagination.hasMore??(Number(pagination.totalPages??1)>1))},
    refinements,provenance:Object.fromEntries(Object.entries(provenance).filter(([,v])=>typeof v==='string')) as Record<string,string>,
    limitations:Array.isArray(payload.limitations)?payload.limitations.filter((x):x is string=>typeof x==='string'):[],
    destinations:[...new Map(rows.map((row)=>[row.destination.href,row.destination])).values()],
    latencyMs,firstUsefulResult:rows.length>0,
  };
}

export async function executeGuidedSpecialist(session: GuidedResearchSession): Promise<GuidedExecutionResult> {
  if (session.hub === 'move') return executeMove(session);
  if (session.hub === 'senior') return executeSenior(session);
  if (session.hub === 'contractor') return executeContractor(session);
  return failure(session, 'INVALID_QUERY', 0, 'pilot_hub_required');
}

export { ENDPOINTS as GUIDED_SPECIALIST_ENDPOINTS };
