import type { GuidedExecutionResult, GuidedRefinement, GuidedResearchSession, GuidedResultRow, GuidedResultState } from './contract.ts';

const ENDPOINTS = {
  move: process.env.MOVE_SPECIALIST_EXECUTION_URL ?? 'https://www.movetrusthub.com/api/specialist-execution/v2',
  senior: process.env.SENIOR_SPECIALIST_EXECUTION_URL ?? 'https://www.seniortrusthub.com/api/specialist-execution/v2',
  contractor: process.env.CONTRACTOR_SPECIALIST_EXECUTION_URL ?? 'https://www.contractortrusthub.com/api/specialist-execution/v2',
} as const;
export const SPECIALIST_EXECUTION_CONTRACT = 'trusthub-specialist-execution-v2';
export const CONTRACTOR_CONTRACT_VERSION = '2.1.0';
export const CONTRACTOR_SCHEMA_FINGERPRINT = '4c22013742744eab394f6d644ab1ffc4a287d9205a73545815e8a1619a0f79b5';
export const CONTRACTOR_CONTRACT_FINGERPRINT = '441f0e7c1f62bc4c5f9ed3720c56095d2b10748dcb9ff9130ad7eb62ea2f5eb7';
export const SPECIALIST_TIMEOUT_MS = 5_000;
export const CONTRACTOR_SPECIALIST_TIMEOUT_MS = 8_000;

type FetchOutcome = { status: number; body: Record<string, unknown>; latencyMs: number } | { error: 'TIMEOUT' | 'BACKEND_UNAVAILABLE'; latencyMs: number };

async function specialistFetch(hub: keyof typeof ENDPOINTS, body: unknown): Promise<FetchOutcome> {
  const started = performance.now();
  const controller = new AbortController();
  const timeoutMs = hub === 'contractor' ? CONTRACTOR_SPECIALIST_TIMEOUT_MS : SPECIALIST_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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
    CLARIFICATION_REQUIRED: 'Choose the credential class to research',
    INVALID_GEOGRAPHY: 'Let’s correct this location',
    UNSUPPORTED_STATE_CAPABILITY: 'This source does not currently support that state research',
    UNSUPPORTED_TRADE_CAPABILITY: 'This source does not currently support that credential class',
    PUBLICATION_RESTRICTED: 'No publication-safe records are available for this request',
    EXACT_IDENTITY: 'Exact regulatory identity',
    UNSUPPORTED_CAPABILITY: 'This source does not currently support that research',
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
    role: session.selectedFilters.role as GuidedResearchSession['regulatoryRole'] ?? session.regulatoryRole,
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
  }).filter((row) => Boolean(row.destination?.href));
  const refinements = session.identityName || session.identifier ? [] : normalizeRefinements(payload.availableRefinements).filter((row) => row.id === 'role');
  return supported(session, payload, rows, outcome.latencyMs, refinements);
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
  }).filter((row) => Boolean(row.destination?.href));
  return supported(session, payload, rows, outcome.latencyMs, seniorRefinements(session));
}

function seniorRefinements(session: GuidedResearchSession): GuidedRefinement[] {
  if (session.providerClass === 'nursing_home') return ['overallStars','staffingStars','inspectionStars'].map((id) => ({ id, label: id.replace('Stars',' rating'), values: [1,2,3,4,5].map((v) => ({ value:String(v), label:`${v} CMS stars` })), meaning: 'Source-native CMS measure; not a TrustHub ranking.' }));
  if (session.providerClass === 'home_health') return [{ id:'qpcStars', label:'Quality of Patient Care rating', values:[1,2,3,4,5].map((v)=>({value:String(v),label:`${v} CMS stars`})), meaning:'Source-native Home Health measure only.' }];
  return [];
}

async function executeContractor(session: GuidedResearchSession): Promise<GuidedExecutionResult> {
  const state=session.geography?.stateCode;
  if (!state&&!session.identifier) return failure(session,'INVALID_QUERY',0,'missing_state','Add a state so ContractorTrustHub can select the correct source-backed credential system.');
  const serviceIntent=/\bserv(?:e|es|ing)|\bwork(?:s|ing)?\s+in\b|near me\b/i.test(session.originalQuestion);
  const body = session.identifier ? {
    contract:SPECIALIST_EXECUTION_CONTRACT,queryType:'identifier',state,identifier:session.identifier.value,page:1,limit:10,
  } : {
    contract:SPECIALIST_EXECUTION_CONTRACT,queryType:'cohort',trade:session.trade,state,
    county:session.geography?.county ?? (session.geography?.type==='county'?session.geography.value:undefined),
    city:session.geography?.city ?? (session.geography?.type==='city'?session.geography.value:undefined),
    zip:session.geography?.type==='zip'?session.geography.value:undefined,
    confirmStatewide:session.confirmStatewide||undefined,
    geography:serviceIntent?{stateCode:state,intent:'SERVICE_TERRITORY'}:undefined,
    credentialStatus:session.selectedFilters.credentialStatus??'active_current',page:1,limit:10,
  };
  const outcome = await specialistFetch('contractor', body);
  if ('error' in outcome) return failure(session, outcome.error, outcome.latencyMs, outcome.error.toLowerCase());
  const payload = outcome.body;
  if (text(payload.contract) !== SPECIALIST_EXECUTION_CONTRACT) return failure(session, 'BACKEND_UNAVAILABLE', outcome.latencyMs, 'contract_mismatch');
  if (text(payload.contractVersion)!==CONTRACTOR_CONTRACT_VERSION || text(payload.schemaFingerprint)!==CONTRACTOR_SCHEMA_FINGERPRINT || text(payload.contractFingerprint)!==CONTRACTOR_CONTRACT_FINGERPRINT) return failure(session,'BACKEND_UNAVAILABLE',outcome.latencyMs,'contract_version_mismatch','ContractorTrustHub’s structured research contract is temporarily unavailable because its version lock changed.');
  const rawState=text(payload.resultState);
  const contractorStates=['SUPPORTED_RESULTS','ZERO_MATCHING_ROWS','CLARIFICATION_REQUIRED','INVALID_GEOGRAPHY','UNSUPPORTED_STATE_CAPABILITY','UNSUPPORTED_TRADE_CAPABILITY','PUBLICATION_RESTRICTED','INVALID_QUERY','BACKEND_UNAVAILABLE','TIMEOUT','EXACT_IDENTITY'] as const;
  if (!rawState || !contractorStates.includes(rawState as typeof contractorStates[number])) return failure(session,outcome.status>=500?'BACKEND_UNAVAILABLE':'INVALID_QUERY',outcome.latencyMs,'unknown_result_state');
  const stateResult=rawState as typeof contractorStates[number];
  if (stateResult!=='SUPPORTED_RESULTS' && stateResult!=='ZERO_MATCHING_ROWS' && stateResult!=='EXACT_IDENTITY') {
    const errorCode=text(payload.errorCode)??text(payload.error)??stateResult.toLowerCase();
    const consumerState=stateResult==='BACKEND_UNAVAILABLE'||stateResult==='TIMEOUT'||stateResult==='INVALID_QUERY'||stateResult==='INVALID_GEOGRAPHY'||stateResult==='CLARIFICATION_REQUIRED'||stateResult==='PUBLICATION_RESTRICTED'||stateResult==='UNSUPPORTED_STATE_CAPABILITY'||stateResult==='UNSUPPORTED_TRADE_CAPABILITY'?stateResult:'UNSUPPORTED_CAPABILITY';
    const message=errorCode==='new_jersey_credential_class_required'
      ? 'Choose the New Jersey credential class you want to research. ContractorTrustHub keeps HIC and each specialty separate.'
      : errorCode==='no_new_jersey_statewide_general_contractor_class'
        ? 'New Jersey does not have one unified statewide General Contractor credential class in this source. Home Improvement Contractor registration is not being relabeled General; choose HIC or a supported specialty.'
        : errorCode==='summit_is_city_in_union_county'
          ? 'Summit is a city in Union County, New Jersey. “Summit County, New Jersey” was not executed as a county.'
          : errorCode==='statewide_fallback_confirmation_required'
            ? 'The requested local geography is not authoritative for cohort filtering. You may explicitly choose statewide New Jersey credential records.'
            : errorCode==='unsupported_service_territory'
              ? 'ContractorTrustHub researches credential jurisdiction and recorded addresses, not service territory or current availability.'
              : errorCode==='unsupported_florida_electrical_source'
                ? 'We understood Florida electrical-contractor research. The accepted Florida construction source does not include the separately regulated electrical credentials.'
                : undefined;
    const result=failure(session,consumerState,outcome.latencyMs,errorCode,message);
    result.limitations=Array.isArray(payload.limitations)?payload.limitations.filter((x):x is string=>typeof x==='string'):[];
    const supportedTrades=new Set(['home_improvement','electrical','plumbing','hvac','mechanical','alarm','telecom','locksmith','hearth','general','building','roofing','pool_spa']);
    result.choices=records(payload.capabilityChoices).flatMap((choice)=>{
      if (choice.supported!==true || !text(choice.id) || !text(choice.label)) return [];
      const id=text(choice.id)!;
      if(id!=='statewide'&&id!=='summit_city'&&!supportedTrades.has(id))return [];
      const value=id==='statewide'?'contractor_statewide':id==='summit_city'?'contractor_geography:summit_city':`contractor_trade:${id}`;
      return [{id:`contractor-${id}`,label:text(choice.label)!,action:'SELECT_CHOICE' as const,value,description:text(choice.limitation)}];
    });
    const interpretation=record(payload.queryInterpretation);const geography=record(interpretation.geography);const correction=record(interpretation.correction);
    const resolvedLabel=[text(geography.city)??text(correction.city),text(record(geography.county).label)??text(correction.county),text(geography.state)??text(correction.state)].filter(Boolean).join(', ');
    if(resolvedLabel)result.interpretation.push({label:'Source geography',value:resolvedLabel});
    result.destinations=normalizeContractorDestinations(payload);
    for(const choice of records(payload.capabilityChoices)){const href=text(choice.destination);if(href&&/^https:\/\//i.test(href))result.destinations.push({type:'VERIFY',href,label:text(choice.label)??'Continue with credential verification'});}
    result.destinations=result.destinations.filter((destination,index,all)=>all.findIndex((other)=>other.href===destination.href)===index);
    result.firstUsefulResult=stateResult==='CLARIFICATION_REQUIRED'||stateResult==='INVALID_GEOGRAPHY'||stateResult==='UNSUPPORTED_TRADE_CAPABILITY';
    return result;
  }
  const rows = records(payload.rows).map((row): GuidedResultRow => {
    const geo=record(row.recordedGeography); const source=record(row.source); const credential=text(row.credentialNumber);
    const destination=normalizeContractorDestinations(row)[0];
    const jurisdiction=state==='NJ'?'New Jersey':state==='FL'?'Florida':state;
    return {
      name:text(row.name) ?? 'Published credential holder',hub:'contractor',identifier:credential?{label:'Credential',value:credential}:undefined,
      classLabel:text(row.credentialClass)??text(row.trade),recordedLocation:[text(geo.city),text(geo.county),text(geo.state)].filter(Boolean).join(', '),
      status:text(row.status),sourceDate:text(source.observedAt),whyShown:`Matched the selected ${session.geography?.stateName ?? state} source-owned trade, status, and recorded-geography filters.`,
      destination,
      facts:[jurisdiction?{label:'Credential jurisdiction',value:jurisdiction}:null,text(row.occupationCode)?{label:'Source class',value:text(row.occupationCode)!}:null,text(source.label)?{label:'Source',value:text(source.label)!}:null].filter(Boolean) as Array<{label:string;value:string}>,
    };
  });
  const result=supported(session,payload,rows,outcome.latencyMs,normalizeRefinements(payload.availableRefinements).filter((row)=>row.id==='credentialStatus'));
  if(stateResult==='EXACT_IDENTITY')result.resultState='EXACT_IDENTITY';
  const interpretation=record(payload.queryInterpretation);const sourceTrade=text(interpretation.trade);const sourceGeo=record(interpretation.geography);
  if(state==='NJ'&&sourceTrade){result.consumerHeading=`New Jersey ${formatCredentialClass(sourceTrade)} research results`;result.consumerMessage=`${result.total.toLocaleString('en-US')} publication-safe New Jersey credential records match these source-owned filters. New Jersey is the credential jurisdiction; a registrant's recorded address may be outside New Jersey. Source order only — not a ranking.`;result.limitations.push('Credential jurisdiction and recorded address are different fields. A recorded address does not prove headquarters, service territory, or current availability.');}
  if(sourceGeo.fallbackApplied===true)result.interpretation.push({label:'Geography scope',value:'Statewide New Jersey credential records — explicitly confirmed'});
  result.destinations=[...new Map(rows.flatMap((row)=>row.destination?[row.destination]:[]).map((destination)=>[destination.href,destination])).values()];
  return result;
}

function formatCredentialClass(value:string):string {
  return value.toLowerCase().replace(/\bhvacr\b/g,'HVACR').replace(/\bhvac\b/g,'HVAC').replace(/\bhic\b/g,'HIC');
}

function normalizeContractorDestinations(value: unknown): NonNullable<GuidedResultRow['destination']>[] {
  const row=record(value);const candidates=records(row.destinations);
  if(text(row.destination))candidates.unshift({type:'PUBLIC_PROFILE',url:text(row.destination)});
  const allowed=new Set(['PUBLIC_PROFILE','CONTRACTORTRUSTHUB_VERIFY','OFFICIAL_BOARD_VERIFICATION']);
  return candidates.flatMap((candidate)=>{
    const kind=text(candidate.type);const href=text(candidate.url)??text(candidate.destination);
    if(!kind||!href||!allowed.has(kind)||!/^https:\/\//i.test(href))return [];
    return [{type:kind==='PUBLIC_PROFILE'?'PROFILE' as const:'VERIFY' as const,href,label:kind==='PUBLIC_PROFILE'?'Open ContractorTrustHub profile':kind==='CONTRACTORTRUSTHUB_VERIFY'?'Verify on ContractorTrustHub':'Verify with the official board'}];
  }).filter((destination,index,all)=>all.findIndex((other)=>other.href===destination.href)===index);
}

function supported(session: GuidedResearchSession, payload: Record<string, unknown>, rows: GuidedResultRow[], latencyMs: number, refinements: GuidedRefinement[]): GuidedExecutionResult {
  const total = Number(payload.total ?? rows.length);
  const state: GuidedResultState = total === 0 ? 'ZERO_MATCHING_ROWS' : 'SUPPORTED_RESULTS';
  const pagination=record(payload.pagination); const provenance=record(payload.provenance);
  const resolution=text(record(payload.queryInterpretation).resolutionClass);
  const consumerHeading=state==='ZERO_MATCHING_ROWS'
    ? session.identityName?'No confident match found':'No public records match these exact filters'
    : session.identifier?'Exact regulatory identity'
      : session.identityName&&resolution==='FUZZY_CANDIDATES'?'Possible published identities'
        : session.identityName?'Multiple published identities'
          : session.providerClass?`${session.providerClass.replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase())} research results`
            : session.trade?'Contractor credential research results'
              : session.moveMode==='auto_transport'?'Auto Transport research results':'Mover research results';
  return {
    specialist:session.hub!,resultState:state,consumerHeading,
    consumerMessage:state==='SUPPORTED_RESULTS'?`${total.toLocaleString('en-US')} public records match these source-owned filters. Source order only — not a ranking.`:'The specialist executed the supported filters and returned zero matching public records.',
    interpretation:interpretation(session),rows,total,
    pagination:{page:Number(pagination.page??1),limit:Number(pagination.limit??pagination.pageSize??10),hasMore:Boolean(pagination.hasMore??(Number(pagination.totalPages??1)>1))},
    refinements,provenance:Object.fromEntries(Object.entries(provenance).filter(([,v])=>typeof v==='string')) as Record<string,string>,
    limitations:Array.isArray(payload.limitations)?payload.limitations.filter((x):x is string=>typeof x==='string'):[],
    destinations:[...new Map(rows.flatMap((row)=>row.destination?[[row.destination.href,row.destination] as const]:[])).values()],
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
