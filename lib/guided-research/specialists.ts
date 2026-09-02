import type { GuidedExecutionResult, GuidedRefinement, GuidedResearchSession, GuidedResultRow, GuidedResultState } from './contract.ts';

const ENDPOINTS = {
  move: process.env.MOVE_SPECIALIST_EXECUTION_URL ?? 'https://www.movetrusthub.com/api/specialist-execution/v2',
  senior: process.env.SENIOR_SPECIALIST_EXECUTION_URL ?? 'https://www.seniortrusthub.com/api/specialist-execution/v2',
  contractor: process.env.CONTRACTOR_SPECIALIST_EXECUTION_URL ?? 'https://www.contractortrusthub.com/api/specialist-execution/v2',
  investor: process.env.INVESTOR_SPECIALIST_EXECUTION_URL ?? 'https://www.investortrusthub.com/api/specialist-execution/v2',
  insurance: process.env.INSURANCE_SPECIALIST_EXECUTION_URL ?? 'https://www.insurancetrusthub.com/api/specialist-execution/v2',
  lender: process.env.LENDER_SPECIALIST_EXECUTION_URL ?? 'https://www.lendertrusthub.com/api/specialist-execution/v2',
} as const;
export const SPECIALIST_EXECUTION_CONTRACT = 'trusthub-specialist-execution-v2';
export const CONTRACTOR_CONTRACT_VERSION = '2.1.0';
export const CONTRACTOR_SCHEMA_FINGERPRINT = '4c22013742744eab394f6d644ab1ffc4a287d9205a73545815e8a1619a0f79b5';
export const CONTRACTOR_CONTRACT_FINGERPRINT = '441f0e7c1f62bc4c5f9ed3720c56095d2b10748dcb9ff9130ad7eb62ea2f5eb7';
export const SPECIALIST_TIMEOUT_MS = 5_000;
export const CONTRACTOR_SPECIALIST_TIMEOUT_MS = 8_000;
export const FINANCIAL_SPECIALIST_LOCKS = {
  investor:{version:'2.0.0',schemaFingerprint:'a92b72c4a30de1021ecf25d26decb852b52394f741ac26919b89d14a234ab384',contractFingerprint:'13c6d3a8e573b65490d50c88534bfcf604dfdeaed64fc0522ff7ef9c4b2b7efa',timeoutMs:6_000},
  insurance:{version:'2.0.0',schemaFingerprint:'4aa93bb372aebb45c7028b750000e77be4a847d9a210f3c40d3db1df1f7f637f',contractFingerprint:'1292fd1ee4ce13a4d934dcb8c3deb21208d4e1e59049cbb8eb22793b310c1071',timeoutMs:8_000},
  lender:{version:'2.1.0',schemaFingerprint:'0da572d08450e68f4f01a4f4b28e2e813503f50b1a84546a29d7eb817db205dd',contractFingerprint:'66d47651fc92ddec9866f7b37a36f67f0b9261daba27652f6753ce0d05ec3321',timeoutMs:8_000},
} as const;

type FetchOutcome = { status: number; body: Record<string, unknown>; latencyMs: number } | { error: 'TIMEOUT' | 'BACKEND_UNAVAILABLE'; latencyMs: number };

async function specialistFetch(hub: keyof typeof ENDPOINTS, body: unknown): Promise<FetchOutcome> {
  const started = performance.now();
  const controller = new AbortController();
  const timeoutMs = hub === 'contractor' ? CONTRACTOR_SPECIALIST_TIMEOUT_MS : hub in FINANCIAL_SPECIALIST_LOCKS ? FINANCIAL_SPECIALIST_LOCKS[hub as keyof typeof FINANCIAL_SPECIALIST_LOCKS].timeoutMs : SPECIALIST_TIMEOUT_MS;
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
    NO_CONFIDENT_MATCH: 'No confident identity match',
    AMBIGUOUS_IDENTITIES: 'Multiple possible published identities',
    IDENTITY_COLLISION: 'This identifier matches more than one regulatory namespace',
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
  const names={senior:'SeniorTrustHub',contractor:'ContractorTrustHub',move:'MoveTrustHub',investor:'InvestorTrustHub',insurance:'InsuranceTrustHub',lender:'LenderTrustHub'} as const;
  const rows: Array<{label:string;value:string}> = [{ label: 'Specialist', value: names[session.hub!] }];
  if (session.providerClass) rows.push({ label: 'Provider class', value: session.providerClass.replaceAll('_', ' ') });
  if (session.trade) rows.push({ label: 'Trade', value: session.trade });
  if (session.moveMode) rows.push({ label: 'Research class', value: session.moveMode.replaceAll('_', ' ') });
  if (session.regulatoryRole) rows.push({ label: 'Regulatory role', value: session.regulatoryRole });
  if (session.geography) rows.push({ label: 'Recorded geography', value: session.geography.value });
  if(session.investorFirmClass)rows.push({label:'Firm class',value:session.investorFirmClass.toUpperCase()});
  if(session.insuranceEntityClass)rows.push({label:'Insurance class',value:session.insuranceEntityClass.replaceAll('_',' ')});
  if(session.lenderResearchMode)rows.push({label:'Lender research',value:session.lenderResearchMode.replaceAll('_',' ')});
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
    const id = text(row.id) ?? text(row.field) ?? text(row.key);
    if (!id) continue;
    const values = Array.isArray(row.values) ? row.values.slice(0,30).flatMap((v)=>{
      if(typeof v==='string')return [{value:v,label:v.replaceAll('_',' ')}];
      const item=record(v);const value=text(item.value)??text(item.id);if(!value)return [];
      return [{value,label:text(item.label)??value.replaceAll('_',' ')}];
    }) : [];
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

const FINANCIAL_STATES = new Set<GuidedResultState>([
  'SUPPORTED_RESULTS','ZERO_MATCHING_ROWS','EXACT_IDENTITY','NO_CONFIDENT_MATCH','AMBIGUOUS_IDENTITIES','IDENTITY_COLLISION',
  'CLARIFICATION_REQUIRED','INVALID_GEOGRAPHY','UNSUPPORTED_STATE_CAPABILITY','UNSUPPORTED_TRADE_CAPABILITY',
  'UNSUPPORTED_CAPABILITY','PUBLICATION_RESTRICTED','INVALID_QUERY','BACKEND_UNAVAILABLE','TIMEOUT',
]);

function validateFinancialContract(hub:'investor'|'insurance'|'lender',payload:Record<string,unknown>):boolean{
  const lock=FINANCIAL_SPECIALIST_LOCKS[hub];
  return text(payload.contract)===SPECIALIST_EXECUTION_CONTRACT&&text(payload.contractVersion)===lock.version&&text(payload.schemaFingerprint)===lock.schemaFingerprint&&text(payload.contractFingerprint)===lock.contractFingerprint;
}

function financialState(payload:Record<string,unknown>,status:number):GuidedResultState{
  const raw=text(payload.resultState);
  if(raw&&FINANCIAL_STATES.has(raw as GuidedResultState))return raw as GuidedResultState;
  return status>=500?'BACKEND_UNAVAILABLE':status>=400?'INVALID_QUERY':'BACKEND_UNAVAILABLE';
}

function safeFinancialDestination(hub:'investor'|'insurance'|'lender',candidate:unknown):NonNullable<GuidedResultRow['destination']>|undefined{
  const row=record(candidate);const raw=text(row.url)??text(row.href)??text(row.destination);
  if(!raw)return undefined;
  const origins={investor:'https://www.investortrusthub.com',insurance:'https://www.insurancetrusthub.com',lender:'https://www.lendertrusthub.com'} as const;
  let url:URL;try{url=new URL(raw,origins[hub]);}catch{return undefined;}
  const allowedOrigins=new Set([origins[hub],hub==='investor'?'https://adviserinfo.sec.gov':hub==='lender'?'https://www.consumerfinance.gov':origins[hub]]);
  if(url.protocol!=='https:'||!allowedOrigins.has(url.origin))return undefined;
  const kind=text(row.type)??'';
  const official=/OFFICIAL|SEC_IARD/i.test(kind);
  return {type:official?'OFFICIAL_SOURCE':/PROFILE/i.test(kind)?'PROFILE':'RESEARCH_IDENTITY',href:url.toString(),label:official?'Verify with the official source':`Open ${hub==='investor'?'InvestorTrustHub':hub==='insurance'?'InsuranceTrustHub':'LenderTrustHub'} research`};
}

function financialFailure(session:GuidedResearchSession,payload:Record<string,unknown>,state:GuidedResultState,latencyMs:number):GuidedExecutionResult{
  const errorRow=record(payload.error);const code=text(payload.errorCode)??text(errorRow.code)??state.toLowerCase();
  const message=text(payload.message)??text(errorRow.message)??(Array.isArray(payload.limitations)?text(payload.limitations[0]):undefined);
  const result=failure(session,state,latencyMs,code,message);
  result.limitations=Array.isArray(payload.limitations)?payload.limitations.filter((x):x is string=>typeof x==='string'):[];
  const hub=session.hub as 'investor'|'insurance'|'lender';
  result.destinations=[...records(payload.destinations),...records(payload.capabilityChoices)].flatMap((row)=>{const destination=safeFinancialDestination(hub,row);return destination?[destination]:[]}).filter((destination,index,all)=>all.findIndex((other)=>other.href===destination.href)===index);
  result.choices=records(payload.capabilityChoices).flatMap((row,index)=>{
    const value=text(row.value)??text(row.id);const label=text(row.label);if(!value||!label)return [];
    const mapped=hub==='lender'&&/property/i.test(value)?'lender_property_market':`${hub}_choice:${value}`;
    return [{id:`${hub}-choice-${index}`,label,action:'SELECT_CHOICE' as const,value:mapped,description:text(row.description)??text(row.limitation)}];
  });
  result.firstUsefulResult=Boolean(result.consumerMessage)||Boolean(result.choices?.length);
  return result;
}

async function executeInvestor(session:GuidedResearchSession):Promise<GuidedExecutionResult>{
  const service=/\bserv(?:e|es|ing)\b/i.test(session.originalQuestion);
  const ranking=/\b(?:best|top)\b/i.test(session.originalQuestion);
  const performance=session.requestedEvidence.includes('PERFORMANCE')||session.requestedEvidence.includes('SAFETY_RANKING');
  if(ranking||performance||service||session.investorFirmClass==='individual_representative'){
    const state=session.investorFirmClass==='individual_representative'?'PUBLICATION_RESTRICTED':'UNSUPPORTED_CAPABILITY';
    const code=session.investorFirmClass==='individual_representative'?'individual_representative_publication_restricted':service?'service_territory_not_supported':performance?'performance_or_safety_ranking_not_supported':'ranking_not_supported';
    const message=session.investorFirmClass==='individual_representative'?'Individual investment-adviser representatives are not published through this public contract. Research firms or an exact organization CRD instead.':service?'InvestorTrustHub can research principal-office geography, but principal office does not prove client geography or service territory.':'InvestorTrustHub does not rank firms or publish performance or safety winners. Filer-reported RAUM is not performance, returns, safety, or quality.';
    const result=failure(session,state,0,code,message);result.limitations=[message,'SEC/IARD registration is not approval or endorsement.'];result.firstUsefulResult=true;return result;
  }
  const filters:Record<string,unknown>={};
  const minimum=Number(session.selectedFilters.minimumRaum??session.minimumRaum);const maximum=Number(session.selectedFilters.maximumRaum??session.maximumRaum);
  if(Number.isFinite(minimum)&&minimum>0)filters.minimumRaum=minimum;
  if(Number.isFinite(maximum)&&maximum>0)filters.maximumRaum=maximum;
  const compensation=session.selectedFilters.compensationMethods??session.compensationMethod;if(compensation)filters.compensationMethods=[compensation];
  const firmClass=(session.selectedFilters.firmClass as GuidedResearchSession['investorFirmClass'])??session.investorFirmClass??'ria_and_era';
  const body=session.identifier?{contract:SPECIALIST_EXECUTION_CONTRACT,queryType:'identifier',identifier:{type:'CRD',value:session.identifier.value},limit:10}
    :session.identityName?{contract:SPECIALIST_EXECUTION_CONTRACT,queryType:'identity',identityName:session.identityName,limit:10}
      :performance?{contract:SPECIALIST_EXECUTION_CONTRACT,queryType:'evidence',requestedEvidence:session.requestedEvidence}
        :{contract:SPECIALIST_EXECUTION_CONTRACT,queryType:'cohort',entityClass:firmClass,geography:session.geography?{stateCode:session.geography.stateCode,intent:service?'SERVICE_TERRITORY':'PRINCIPAL_OFFICE'}:undefined,filters:Object.keys(filters).length?filters:undefined,rankingIntent:ranking||undefined,page:1,limit:10};
  const outcome=await specialistFetch('investor',body);if('error'in outcome)return failure(session,outcome.error,outcome.latencyMs,outcome.error.toLowerCase());
  const payload=outcome.body;if(!validateFinancialContract('investor',payload))return failure(session,'BACKEND_UNAVAILABLE',outcome.latencyMs,'contract_mismatch','InvestorTrustHub’s structured contract lock changed.');
  const state=financialState(payload,outcome.status);if(!['SUPPORTED_RESULTS','ZERO_MATCHING_ROWS','EXACT_IDENTITY'].includes(state))return financialFailure(session,payload,state,outcome.latencyMs);
  const rows=records(payload.rows).map((row):GuidedResultRow=>{
    const crd=text(row.crd);const raum=record(row.raum);const destinations=records(row.destinations);if(text(row.canonicalProfileUrl))destinations.unshift({type:'PUBLIC_PROFILE',url:text(row.canonicalProfileUrl)});
    const destination=destinations.map((candidate)=>safeFinancialDestination('investor',candidate)).find(Boolean);
    return {name:text(row.firmName)??text(row.legalName)??'Investment-adviser firm',hub:'investor',identifier:crd?{label:'CRD',value:crd}:undefined,classLabel:text(row.firmClass)?.toUpperCase(),recordedLocation:text(row.principalOffice),status:text(row.registrationStatus),sourceDate:text(row.sourceAsOf)??text(row.filingDate),whyShown:text(row.whyMatched)??'Matched the selected SEC/IARD firm filters.',destination,facts:[text(raum.display)?{label:'Filer-reported RAUM',value:text(raum.display)!}:null,Array.isArray(row.compensationMethods)&&row.compensationMethods.length?{label:'Reported compensation',value:row.compensationMethods.filter((x):x is string=>typeof x==='string').join(', ')}:null].filter(Boolean) as Array<{label:string;value:string}>};
  });
  const refinements=normalizeRefinements(payload.availableRefinements).filter((row)=>['firmClass','minimumRaum','maximumRaum','compensationMethods'].includes(row.id));
  const result=supported(session,payload,rows,outcome.latencyMs,refinements);result.resultState=state;
  result.consumerHeading=state==='EXACT_IDENTITY'?'Exact regulatory identity':`${firmClass==='ria'?'RIA':firmClass==='era'?'ERA':'Investment adviser firm'} research results`;
  result.consumerMessage=state==='ZERO_MATCHING_ROWS'?'No public SEC/IARD firm records match these exact filters.':`${result.total.toLocaleString('en-US')} current firm records match. Principal-office geography is not client geography or service territory; source order is not a ranking.`;
  return result;
}

async function executeInsurance(session:GuidedResearchSession):Promise<GuidedExecutionResult>{
  const service=/\bserv(?:e|es|ing)|near me\b/i.test(session.originalQuestion);const ranking=/\b(?:best|top)\b/i.test(session.originalQuestion);
  if(session.insuranceLineOfAuthority==='life'){
    const message='InsuranceTrustHub understands the requested life-insurance credential class, but its current public execution contract does not advertise a compatible source-native life line-of-authority filter.';
    const result=failure(session,'UNSUPPORTED_CAPABILITY',0,'line_of_authority_filter_not_supported',message);
    result.limitations=[message,'A line of authority is not an insurer appointment, office location, service territory, or product availability.'];
    result.firstUsefulResult=true;
    return result;
  }
  const filters:Record<string,unknown>={};const loa=session.selectedFilters.lineOfAuthority??session.insuranceLineOfAuthority;if(loa)filters.lineOfAuthority=[loa];
  const body=session.identifier?{contract:SPECIALIST_EXECUTION_CONTRACT,queryType:'identifier',identifier:{type:session.identifier.type,value:session.identifier.value},limit:10}
    :ranking?{contract:SPECIALIST_EXECUTION_CONTRACT,queryType:'evidence',entityClass:'legal_insurer',requestedEvidence:['RANKING']}
      :{contract:SPECIALIST_EXECUTION_CONTRACT,queryType:'cohort',entityClass:session.insuranceEntityClass,geography:session.geography?{stateCode:session.geography.stateCode,intent:service?'SERVICE_TERRITORY':session.insuranceEntityClass==='legal_insurer'?'DOMICILE':'CREDENTIAL_JURISDICTION'}:service?{intent:'SERVICE_TERRITORY'}:undefined,filters:Object.keys(filters).length?filters:undefined,page:1,limit:10};
  const outcome=await specialistFetch('insurance',body);if('error'in outcome)return failure(session,outcome.error,outcome.latencyMs,outcome.error.toLowerCase());
  const payload=outcome.body;if(!validateFinancialContract('insurance',payload))return failure(session,'BACKEND_UNAVAILABLE',outcome.latencyMs,'contract_mismatch','InsuranceTrustHub’s structured contract lock changed.');
  const state=financialState(payload,outcome.status);if(!['SUPPORTED_RESULTS','ZERO_MATCHING_ROWS','EXACT_IDENTITY'].includes(state))return financialFailure(session,payload,state,outcome.latencyMs);
  const rows=records(payload.rows).map((row):GuidedResultRow=>{
    const entityClass=text(row.entityClass);const npn=text(row.npn);const naic=text(row.naicCode);const destination=safeFinancialDestination('insurance',{type:entityClass==='legal_insurer'?'PUBLIC_PROFILE':'RESEARCH_IDENTITY',url:text(row.destination)});
    return {name:text(row.name)??'Insurance research identity',hub:'insurance',identifier:naic?{label:'NAIC Company Code',value:naic}:npn?{label:'NPN',value:npn}:undefined,classLabel:entityClass?.replaceAll('_',' '),recordedLocation:text(row.credentialJurisdiction),status:text(row.credentialStatus),sourceDate:text(row.sourceObservedAt),whyShown:text(row.whyMatched)??'Matched the selected public-safe insurance filters.',destination,facts:[text(row.licenseNumber)?{label:'Credential',value:text(row.licenseNumber)!}:null,text(row.licenseClass)?{label:'Credential class',value:text(row.licenseClass)!}:null,text(row.publicationState)?{label:'Publication state',value:text(row.publicationState)!}:null].filter(Boolean) as Array<{label:string;value:string}>};
  });
  const refinements=normalizeRefinements(payload.availableRefinements).filter((row)=>session.insuranceEntityClass==='agency'&&['credentialJurisdiction','lineOfAuthority'].includes(row.id));
  const result=supported(session,payload,rows,outcome.latencyMs,refinements);result.resultState=state;
  result.consumerHeading=state==='EXACT_IDENTITY'?'Exact regulatory identity':session.insuranceEntityClass==='legal_insurer'?'Public legal-insurer research results':'Insurance agency research results';
  result.consumerMessage=state==='ZERO_MATCHING_ROWS'?'No public-safe insurance records match these exact filters.':`${result.total.toLocaleString('en-US')} public-safe ${session.insuranceEntityClass==='legal_insurer'?'legal-insurer':'agency'} records match. Credential jurisdiction is not office, domicile, service territory, or product availability.`;
  return result;
}

async function executeLender(session:GuidedResearchSession):Promise<GuidedExecutionResult>{
  const service=/\bserv(?:e|es|ing)|near me\b/i.test(session.originalQuestion);const ranking=/\b(?:best|top|safest)\b/i.test(session.originalQuestion);
  if(ranking||session.lenderResearchMode==='unsupported_person_branch'){
    const state=session.lenderResearchMode==='unsupported_person_branch'?'PUBLICATION_RESTRICTED':'UNSUPPORTED_CAPABILITY';
    const message=state==='PUBLICATION_RESTRICTED'?'Branch and individual MLO mass publication is restricted. Research an institution, exact NMLS/LEI, or HMDA property market instead.':'LenderTrustHub does not rank mortgage lenders. Raw HMDA activity is not quality, safety, or a recommendation.';
    const result=failure(session,state,0,state==='PUBLICATION_RESTRICTED'?'person_or_branch_publication_restricted':'ranking_not_supported',message);result.limitations=[message];result.firstUsefulResult=true;return result;
  }
  const countyFips=session.geography?.county?.toLowerCase()==='broward'?'12011':session.geography?.county?.toLowerCase()==='palm beach'?'12099':undefined;
  const action=(session.selectedFilters.action as GuidedResearchSession['hmdaAction'])??session.hmdaAction??'origination';
  const loanType=(session.selectedFilters.loanType as GuidedResearchSession['loanType'])??session.loanType;
  const geography=session.geography?{intent:service?'SERVICE_TERRITORY':session.lenderResearchMode?'PROPERTY_MARKET':undefined,stateCode:session.geography.stateCode,county:session.geography.county,countyFips}:service?{intent:'SERVICE_TERRITORY'}:undefined;
  const body=session.identifier?{contract:SPECIALIST_EXECUTION_CONTRACT,queryType:'identifier',identifier:{type:session.identifier.type,value:session.identifier.value},limit:10}
    :session.lenderResearchMode==='complaints'?{contract:SPECIALIST_EXECUTION_CONTRACT,queryType:'evidence',identityName:session.identityName,requestedEvidence:['CFPB_COMPLAINTS'],limit:10}
      :session.lenderResearchMode==='identity_name'?{contract:SPECIALIST_EXECUTION_CONTRACT,queryType:'identity',identityName:session.identityName,limit:10}
        :{contract:SPECIALIST_EXECUTION_CONTRACT,queryType:'market_cohort',entityClass:'hmda_reporting_institution',geography,action,loanType,rankingIntent:ranking||undefined,page:1,limit:10};
  const outcome=await specialistFetch('lender',body);if('error'in outcome)return failure(session,outcome.error,outcome.latencyMs,outcome.error.toLowerCase());
  const payload=outcome.body;if(!validateFinancialContract('lender',payload))return failure(session,'BACKEND_UNAVAILABLE',outcome.latencyMs,'contract_mismatch','LenderTrustHub’s structured contract lock changed.');
  const state=financialState(payload,outcome.status);if(!['SUPPORTED_RESULTS','ZERO_MATCHING_ROWS','EXACT_IDENTITY'].includes(state))return financialFailure(session,payload,state,outcome.latencyMs);
  const sourceRows=records(payload.rows);const identity=record(payload.identity);
  const rows=(sourceRows.length?sourceRows:Object.keys(identity).length?[identity]:[]).map((row):GuidedResultRow=>{
    const nmls=text(row.nmls);const lei=text(row.lei);const evidenceCount=Number(row.attachedObservationCount);
    const destination=safeFinancialDestination('lender',record(row.destination));
    return {name:text(row.displayName)??text(row.institutionName)??text(row.sourceCompanyLabel)??'Lender research identity',hub:'lender',identifier:nmls?{label:'NMLS',value:nmls}:lei?{label:'LEI',value:lei}:undefined,classLabel:text(row.entityClass)??(session.lenderResearchMode==='complaints'?'CFPB complaint evidence':'HMDA reporting institution'),recordedLocation:session.geography?.value,status:text(row.currentStatus)??text(row.publicationState),sourceDate:text(row.sourceFetchedAt)??text(payload.period),whyShown:text(row.whyThisResultAppears)??text(row.whyMatched)??'Matched the selected source-owned lender evidence filters.',destination,facts:[lei?{label:'LEI',value:lei}:null,Number.isFinite(evidenceCount)?{label:'Attached CFPB observations',value:evidenceCount.toLocaleString('en-US')}:null,text(row.action)?{label:'HMDA action',value:text(row.action)!}:null,text(row.loanType)?{label:'Loan type',value:text(row.loanType)!}:null].filter(Boolean) as Array<{label:string;value:string}>};
  });
  const refinements=normalizeRefinements(payload.availableRefinements).filter((row)=>['action','loanType','propertyState','propertyCounty','publicationState'].includes(row.id));
  const result=supported(session,payload,rows,outcome.latencyMs,refinements);result.resultState=state;
  result.consumerHeading=state==='EXACT_IDENTITY'?'Exact regulatory identity':session.lenderResearchMode==='complaints'?'Attached CFPB complaint evidence':'HMDA property-market research results';
  const evidenceState=text(payload.evidenceState);
  if(session.lenderResearchMode==='complaints'&&state==='ZERO_MATCHING_ROWS')result.consumerMessage='The lender identity was found, but no accepted attached complaint aggregate was returned. This is not a clean-record claim.';
  else if(session.lenderResearchMode==='complaints')result.consumerMessage=`${Number(sourceRows[0]?.attachedObservationCount??0).toLocaleString('en-US')} consumer-submitted observations are attached under the accepted identity bridge. They are not findings of wrongdoing, are not size-adjusted, and are not a quality score.`;
  else result.consumerMessage=state==='ZERO_MATCHING_ROWS'?'No HMDA rows match these exact property-market filters.':`${result.total.toLocaleString('en-US')} HMDA LEI-grain records match. Property geography is not headquarters, branch location, licensing, or service territory.`;
  if(evidenceState&&evidenceState!==state)result.interpretation.push({label:'Evidence state',value:evidenceState});
  return result;
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
  if (session.hub === 'investor') return executeInvestor(session);
  if (session.hub === 'insurance') return executeInsurance(session);
  if (session.hub === 'lender') return executeLender(session);
  return failure(session, 'INVALID_QUERY', 0, 'pilot_hub_required');
}

export { ENDPOINTS as GUIDED_SPECIALIST_ENDPOINTS };
