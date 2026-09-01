import type { GuidedAction, GuidedApiResponse, GuidedResearchSession } from './contract.ts';
import { createGuidedSession, parseGuidedGeography, pushHistory, restorePrevious, validateGuidedSession } from './session.ts';
import { executeGuidedSpecialist } from './specialists.ts';

function touch(session: GuidedResearchSession): GuidedResearchSession {
  return { ...session, updatedAt: new Date().toISOString() };
}

function clearExecutionState(session: GuidedResearchSession) {
  return { ...session, selectedFilters: {}, availableRefinements: [], resultCount: undefined };
}

function allowedRefinementValues(session: GuidedResearchSession): Record<string, string[]> {
  if (session.hub === 'senior' && session.providerClass === 'nursing_home') return {overallStars:['1','2','3','4','5'],staffingStars:['1','2','3','4','5'],inspectionStars:['1','2','3','4','5']};
  if (session.hub === 'senior' && session.providerClass === 'home_health') return {qpcStars:['1','2','3','4','5']};
  if (session.hub === 'contractor') return {credentialStatus:['active_current','expired','all']};
  if (session.hub === 'move' && !session.identityName && !session.identifier) return {role:['Carrier','Broker','Carrier/Broker']};
  return {};
}

function validateFilter(session: GuidedResearchSession, field: string, value: string): void {
  const allowed = allowedRefinementValues(session)[field];
  if (!allowed) throw new Error('invalid_filter_field');
  if (!allowed.includes(value)) throw new Error('invalid_filter_value');
  const advertised = session.availableRefinements.find((row) => row.id === field);
  if (!advertised?.values.some((row) => row.value === value)) throw new Error('stale_filter_value');
}

function validateSelectedFilters(session: GuidedResearchSession): void {
  for (const [field, value] of Object.entries(session.selectedFilters)) validateFilter(session, field, value);
}

function afterChoice(session: GuidedResearchSession, value: string): GuidedResearchSession {
  const next = pushHistory(session);
  if (session.hub === 'senior') {
    if (value === 'explain_care') return touch({ ...next, phase: 'CLARIFY', missingFields: ['providerClass'], nextAction: 'Choose a care setting after reviewing the differences.' });
    if (!['nursing_home','home_health','hospice'].includes(value)) throw new Error('invalid_choice');
    return touch({ ...clearExecutionState(next), providerClass: value as GuidedResearchSession['providerClass'], entityClass: value, geography: undefined, identifier:undefined, identityName:undefined, availableChoices: [], missingFields: ['geography'], phase: 'COLLECT', nextAction: 'Where is care needed?' });
  }
  if (session.hub === 'contractor') {
    if (!['roofing','hvac','plumbing','general','pool_spa','mechanical','electrical'].includes(value)) throw new Error('invalid_choice');
    return touch({ ...clearExecutionState(next), trade: value, geography: undefined, identifier:undefined, identityName:undefined, availableChoices: [], missingFields: ['geography'], phase: 'COLLECT', nextAction: 'Where is the property?' });
  }
  if (session.hub === 'move') {
    if (!['mover','auto_transport','identity_name','identifier'].includes(value)) throw new Error('invalid_choice');
    const mode=value as GuidedResearchSession['moveMode'];
    if (mode === 'auto_transport') return touch({ ...clearExecutionState(next), moveMode:mode,entityClass:mode,geography:undefined,identityName:undefined,identifier:undefined,phase:'EXECUTE',missingFields:[],availableChoices:[],nextAction:'execute' });
    const missing=mode==='mover'?'geography':mode==='identity_name'?'identityName':'identifier';
    return touch({ ...clearExecutionState(next),moveMode:mode,entityClass:mode,geography:undefined,identityName:undefined,identifier:undefined,phase:'COLLECT',missingFields:[missing],availableChoices:[],nextAction:mode==='mover'?'Enter a state for recorded-headquarters research.':mode==='identity_name'?'What company name should we research?':'Enter a USDOT or MC number.' });
  }
  throw new Error('invalid_hub');
}

function collectValue(session: GuidedResearchSession, value: string): GuidedResearchSession {
  const next=pushHistory(session);
  if (session.missingFields.includes('geography')) {
    const geography=parseGuidedGeography(value);
    if (!geography) throw new Error('invalid_geography');
    return touch({ ...next,geography,missingFields:[],phase:'EXECUTE',nextAction:'execute' });
  }
  if (session.missingFields.includes('identityName')) {
    const name=value.trim();
    if (name.length<2||name.length>160) throw new Error('invalid_identity_name');
    return touch({ ...next,identityName:name,missingFields:[],phase:'EXECUTE',nextAction:'execute' });
  }
  if (session.missingFields.includes('identifier')) {
    const match=value.trim().match(/^(USDOT|DOT|MC)\s*#?-?\s*(\d{3,8})$/i);
    if (!match) throw new Error('invalid_identifier');
    return touch({ ...next,identifier:{type:/mc/i.test(match[1])?'MC':'USDOT',value:match[2]},missingFields:[],phase:'EXECUTE',nextAction:'execute' });
  }
  throw new Error('nothing_to_collect');
}

export async function orchestrateGuidedResearch(input: { session?: unknown; action: GuidedAction }): Promise<GuidedApiResponse> {
  const started=performance.now(); const requestId=crypto.randomUUID();
  let session: GuidedResearchSession;
  let specialistCalls=0;
  if (input.action.type==='START') {
    const created=createGuidedSession(input.action.question);
    if (!created) throw new Error('not_guided_query');
    session=created;
  } else {
    const valid=validateGuidedSession(input.session);
    if (!valid) {
      const original=(input.session as {originalQuestion?:unknown}|undefined)?.originalQuestion;
      if (typeof original!=='string') throw new Error('invalid_session');
      const reset=createGuidedSession(original);
      if (!reset) throw new Error('not_guided_query');
      session=reset;
    } else session=valid;
    if (input.action.type==='SELECT_CHOICE') session=afterChoice(session,input.action.value);
    else if (input.action.type==='SET_GEOGRAPHY') session=collectValue(session,input.action.value);
    else if (input.action.type==='SET_FILTER') { validateFilter(session,input.action.field,input.action.value);session=touch({ ...pushHistory(session),selectedFilters:{...session.selectedFilters,[input.action.field]:input.action.value},phase:'EXECUTE',nextAction:'execute' }); }
    else if (input.action.type==='CLEAR_FILTER') { if (!(input.action.field in session.selectedFilters)) throw new Error('invalid_filter_field');const filters={...session.selectedFilters};delete filters[input.action.field];session=touch({...pushHistory(session),selectedFilters:filters,phase:'EXECUTE',nextAction:'execute'}); }
    else if (input.action.type==='CLEAR_ALL_FILTERS') { if (!Object.keys(session.selectedFilters).length) throw new Error('no_active_filters');session=touch({...pushHistory(session),selectedFilters:{},phase:'EXECUTE',nextAction:'execute'}); }
    else if (input.action.type==='BACK') session=restorePrevious(session);
    else if (input.action.type==='RESET') session=createGuidedSession(session.originalQuestion)!;
  }
  let result;
  const shouldRestoreResults = (input.action.type === 'RESUME' || input.action.type === 'BACK') && (session.phase === 'REFINE' || session.phase === 'ERROR_RECOVERY');
  if (session.phase==='EXECUTE' || input.action.type==='EXECUTE' || shouldRestoreResults) {
    validateSelectedFilters(session);
    specialistCalls=1;
    result=await executeGuidedSpecialist(session);
    session=touch({...session,phase:result.resultState==='BACKEND_UNAVAILABLE'||result.resultState==='TIMEOUT'?'ERROR_RECOVERY':'REFINE',availableRefinements:result.refinements,resultCount:result.total,nextAction:result.resultState==='SUPPORTED_RESULTS'?'Narrow these results or open a specialist profile.':'Review the limitation and choose a useful next action.'});
  }
  return {session,result,diagnostics:{requestId,hub:session.hub,phase:session.phase,resultState:result?.resultState,latencyMs:Math.round(performance.now()-started),resultCount:result?.total??0,specialistCalls}};
}
