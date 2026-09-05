import type { GuidedAction, GuidedApiResponse, GuidedResearchSession } from './contract.ts';
import { createGuidedSession, INSURANCE_CHOICES, INVESTOR_CHOICES, LENDER_CHOICES, parseGuidedGeography, pushHistory, restorePrevious, TRADE_CHOICES, validateGuidedSession } from './session.ts';
import { executeGuidedSpecialist } from './specialists.ts';
import { planRequiresImmediateClarification } from '../network/research-planner.ts';

function touch(session: GuidedResearchSession): GuidedResearchSession {
  return { ...session, updatedAt: new Date().toISOString() };
}

function clearExecutionState(session: GuidedResearchSession) {
  return { ...session, selectedFilters: {}, availableRefinements: [], lastExecution: undefined, resultCount: undefined };
}

function allowedRefinementValues(session: GuidedResearchSession): Record<string, string[]> {
  if (session.hub === 'senior' && session.providerClass === 'nursing_home') return {overallStars:['1','2','3','4','5'],staffingStars:['1','2','3','4','5'],inspectionStars:['1','2','3','4','5']};
  if (session.hub === 'senior' && session.providerClass === 'home_health') return {qpcStars:['1','2','3','4','5']};
  if (session.hub === 'contractor') return {credentialStatus:['active_current','expired','all']};
  if (session.hub === 'move' && !session.identityName && !session.identifier) return {role:['Carrier','Broker','Carrier/Broker']};
  if (session.hub === 'investor') return {
    firmClass:['ria','era','ria_and_era'],minimumRaum:['1000000000','2000000000'],maximumRaum:['10000000000'],
    compensationMethods:['percentage_of_assets','hourly_charges','subscription_fees','fixed_fees','commissions','performance_based_fees','other_compensation'],
  };
  if (session.hub === 'insurance' && session.insuranceEntityClass === 'agency') return {credentialJurisdiction:['FL','TX','MA','OH','VT'],lineOfAuthority:['life']};
  if (session.hub === 'lender' && session.lenderResearchMode === 'property_market') return {action:['application','origination','denial'],loanType:['Conventional','FHA','VA','USDA','Other']};
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
    return touch({ ...clearExecutionState(next), providerClass: value as GuidedResearchSession['providerClass'], entityClass: value, geography: undefined, identifier:undefined, identityName:undefined, availableChoices: [], missingFields: ['geography'], phase: 'COLLECT', nextAction: 'Where does she need care?' });
  }
  if (session.hub === 'contractor') {
    if (value === 'contractor_statewide') {
      if (!session.geography?.stateCode || !session.geography.stateName) throw new Error('statewide_geography_unavailable');
      return touch({ ...pushHistory(session),confirmStatewide:true,availableChoices:[],phase:'EXECUTE',nextAction:'execute' });
    }
    if(value==='contractor_geography:summit_city'){
      return touch({...pushHistory(session),geography:{type:'city',value:'Summit, New Jersey',city:'Summit',county:'Union',stateCode:'NJ',stateName:'New Jersey',meaning:'Recorded Summit city geography in Union County, New Jersey; not service territory.'},confirmStatewide:false,availableChoices:[],phase:'EXECUTE',nextAction:'execute'});
    }
    if (value === 'other_trade') return touch({ ...clearExecutionState(next),trade:undefined,geography:undefined,identifier:undefined,identityName:undefined,availableChoices:[],missingFields:['tradeDescription'],phase:'COLLECT',nextAction:'Briefly describe the work you need.' });
    if (value === 'choose_trade') return touch({ ...clearExecutionState(next),trade:undefined,availableChoices:structuredClone(TRADE_CHOICES),missingFields:['trade'],phase:'CLARIFY',nextAction:'Tell us what kind of work you need.' });
    if (value.startsWith('confirm_trade:')) value=value.slice('confirm_trade:'.length);
    if (value.startsWith('contractor_trade:')) value=value.slice('contractor_trade:'.length);
    if (!['roofing','hvac','plumbing','general','building','pool_spa','mechanical','electrical','home_improvement','alarm','telecom','locksmith','hearth'].includes(value)) throw new Error('invalid_choice');
    const geography=session.geography;
    return touch({ ...clearExecutionState(next), trade: value, geography, identifier:undefined, identityName:undefined, availableChoices: [], missingFields: geography?[]:['geography'], phase: geography?'EXECUTE':'COLLECT', nextAction: geography?'execute':'Where is the property?' });
  }
  if (session.hub === 'move') {
    if (!['mover','auto_transport','identity_name','identifier'].includes(value)) throw new Error('invalid_choice');
    const mode=value as GuidedResearchSession['moveMode'];
    if (mode === 'auto_transport') return touch({ ...clearExecutionState(next), moveMode:mode,entityClass:mode,geography:undefined,identityName:undefined,identifier:undefined,phase:'EXECUTE',missingFields:[],availableChoices:[],nextAction:'execute' });
    const missing=mode==='mover'?'geography':mode==='identity_name'?'identityName':'identifier';
    return touch({ ...clearExecutionState(next),moveMode:mode,entityClass:mode,geography:undefined,identityName:undefined,identifier:undefined,phase:'COLLECT',missingFields:[missing],availableChoices:[],nextAction:mode==='mover'?'Enter a state for recorded-headquarters research.':mode==='identity_name'?'What company name should we research?':'Enter a USDOT or MC number.' });
  }
  if(session.hub==='investor'){
    if(value==='investor_mode:explain')return touch({...next,phase:'CLARIFY',missingFields:['investorResearchMode'],availableChoices:structuredClone(INVESTOR_CHOICES),nextAction:'Choose firm research, a CRD, or a specific firm name. Individual representatives are not published.'});
    if(value==='investor_mode:firm_cohort')return touch({...clearExecutionState(next),investorResearchMode:'firm_cohort',investorFirmClass:'ria_and_era',entityClass:'ria_and_era',phase:'COLLECT',missingFields:['geography'],availableChoices:[],nextAction:'Which principal-office state should we research?'});
    if(value==='investor_mode:identifier')return touch({...clearExecutionState(next),investorResearchMode:'identifier',phase:'COLLECT',missingFields:['identifier'],availableChoices:[],nextAction:'Enter an organization CRD.'});
    if(value==='investor_mode:identity_name')return touch({...clearExecutionState(next),investorResearchMode:'identity_name',phase:'COLLECT',missingFields:['identityName'],availableChoices:[],nextAction:'What firm name should we research?'});
  }
  if(session.hub==='insurance'){
    if(value==='insurance_mode:explain')return touch({...next,phase:'CLARIFY',missingFields:['insuranceEntityClass'],availableChoices:structuredClone(INSURANCE_CHOICES),nextAction:'Choose agency, legal insurer, producer, or an exact identifier.'});
    if(value==='insurance_mode:identifier')return touch({...clearExecutionState(next),insuranceResearchMode:'identifier',insuranceEntityClass:undefined,entityClass:undefined,phase:'COLLECT',missingFields:['identifier'],availableChoices:[],nextAction:'Enter an NPN or NAIC company code.'});
    if(value.startsWith('insurance_class:')){
      const cls=value.slice('insurance_class:'.length);
      if(!['agency','producer','legal_insurer'].includes(cls))throw new Error('invalid_choice');
      const insuranceEntityClass=cls as GuidedResearchSession['insuranceEntityClass'];
      const needsGeography=insuranceEntityClass==='agency';
      return touch({...clearExecutionState(next),insuranceResearchMode:'cohort',insuranceEntityClass,entityClass:insuranceEntityClass,phase:needsGeography?'COLLECT':'EXECUTE',missingFields:needsGeography?['geography']:[],availableChoices:[],nextAction:needsGeography?'Which credential jurisdiction should we research?':'execute'});
    }
  }
  if(session.hub==='lender'){
    if(value==='lender_mode:explain')return touch({...next,phase:'CLARIFY',missingFields:['lenderResearchMode'],availableChoices:structuredClone(LENDER_CHOICES),nextAction:'Choose property-market activity, a lender name, an identifier, or complaint evidence.'});
    if(value==='lender_mode:property_market'||value==='lender_property_market')return touch({...clearExecutionState(next),lenderResearchMode:'property_market',entityClass:'hmda_reporting_institution',phase:'COLLECT',missingFields:['geography'],availableChoices:[],nextAction:'Which property market should we research?'});
    if(value==='lender_mode:identity_name')return touch({...clearExecutionState(next),lenderResearchMode:'identity_name',phase:'COLLECT',missingFields:['identityName'],availableChoices:[],nextAction:'What lender name should we research?'});
    if(value==='lender_mode:identifier')return touch({...clearExecutionState(next),lenderResearchMode:'identifier',phase:'COLLECT',missingFields:['identifier'],availableChoices:[],nextAction:'Enter an NMLS or LEI.'});
    if(value==='lender_mode:complaints')return touch({...clearExecutionState(next),lenderResearchMode:'complaints',requestedEvidence:['CFPB_COMPLAINTS'],phase:'COLLECT',missingFields:['identityName'],availableChoices:[],nextAction:'Which known lender should we examine for attached CFPB evidence?'});
  }
  throw new Error('invalid_hub');
}

function collectValue(session: GuidedResearchSession, value: string): GuidedResearchSession {
  const returnContractorResultsToTradeMenu=session.hub==='contractor'&&session.missingFields.includes('geography')&&session.history.at(-1)?.phase==='CLARIFY';
  const next=returnContractorResultsToTradeMenu?session:pushHistory(session);
  if (session.missingFields.includes('tradeDescription')) {
    const description=value.trim().slice(0,160);
    const mappings:Array<[RegExp,string,string]>=[[/\broof/i,'roofing','Roofing'],[/\b(?:air\s*condition|hvac)\b/i,'hvac','Air conditioning / HVAC'],[/\bplumb/i,'plumbing','Plumbing'],[/\belectr/i,'electrical','Electrical'],[/\b(?:general|building|construction)\b/i,'general','General / building construction'],[/\b(?:pool|spa)\b/i,'pool_spa','Pool / spa'],[/\bmechanic/i,'mechanical','Mechanical']];
    const match=mappings.find(([pattern])=>pattern.test(description));
    if (!match) return touch({...next,phase:'CLARIFY',missingFields:['trade'],availableChoices:structuredClone(TRADE_CHOICES),nextAction:'Choose the closest supported source category. Ask will not guess a regulatory trade.'});
    return touch({...next,trade:undefined,phase:'CLARIFY',missingFields:['tradeConfirmation'],availableChoices:[{id:`confirm-${match[1]}`,label:`Yes — ${match[2]}`,action:'SELECT_CHOICE',value:`confirm_trade:${match[1]}`},{id:'choose-trade',label:'Choose a different category',action:'SELECT_CHOICE',value:'choose_trade'}],nextAction:`Did you mean ${match[2]}?`});
  }
  if (session.missingFields.includes('geography')) {
    const geography=parseGuidedGeography(value);
    if (!geography) return touch({ ...session, phase:'COLLECT', missingFields:['geography'], nextAction:'That location contains conflicting geography. Enter a valid state, county, city or ZIP. For example: “Summit, New Jersey” or “Union County, New Jersey”.' });
    if (session.hub==='contractor' && geography.type!=='state' && !geography.stateCode) return touch({ ...session, phase:'COLLECT', missingFields:['geography'], nextAction:`Which state is ${geography.value} in? Enter the city or county together with its state.` });
    return touch({ ...next,geography,missingFields:[],phase:'EXECUTE',nextAction:'execute' });
  }
  if (session.missingFields.includes('identityName')) {
    const name=value.trim();
    if (name.length<2||name.length>160) throw new Error('invalid_identity_name');
    return touch({ ...next,identityName:name,missingFields:[],phase:'EXECUTE',nextAction:'execute' });
  }
  if (session.missingFields.includes('identifier')) {
    const match=value.trim().match(/^(USDOT|DOT|MC|CRD|NPN|NAIC|NMLS|LEI)\s*#?-?\s*([A-Z0-9-]{3,24})$/i);
    if (!match) throw new Error('invalid_identifier');
    const type=/^dot$/i.test(match[1])?'USDOT':match[1].toUpperCase();
    return touch({ ...next,identifier:{type,value:match[2].toUpperCase()},missingFields:[],phase:'EXECUTE',nextAction:'execute' });
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
  const shouldRestoreResults = (input.action.type === 'RESUME' || input.action.type === 'BACK') && (session.phase === 'REFINE' || session.phase === 'ERROR_RECOVERY' || session.phase === 'CLARIFY' && Boolean(session.lastExecution));
  const executionRequested = session.phase==='EXECUTE' || input.action.type==='EXECUTE' || shouldRestoreResults;
  if (executionRequested && !session.researchPlan.executionAllowed && !planRequiresImmediateClarification(session.researchPlan)) {
    session=touch({...session,researchPlan:{...session.researchPlan,executionAllowed:true,executionMode:session.identifier?'IDENTIFIER':session.identityName?'IDENTITY':'COHORT',missingSlots:[],clarificationReason:undefined,reasonCodes:[...session.researchPlan.reasonCodes,'USER_CLARIFICATION_COMPLETED']}});
  }
  if (executionRequested && !session.researchPlan.executionAllowed) {
    session=touch({...session,phase:'CLARIFY',nextAction:session.researchPlan.clarificationReason??'Clarify the research request before specialist execution.'});
  } else if (executionRequested) {
    validateSelectedFilters(session);
    specialistCalls=1;
    result=await executeGuidedSpecialist(session);
    const hasChoices=Boolean(result.choices?.length);
    const phase=result.resultState==='BACKEND_UNAVAILABLE'||result.resultState==='TIMEOUT'?'ERROR_RECOVERY':hasChoices?'CLARIFY':'REFINE';
    const choicePrompt=result.error?.code==='new_jersey_credential_class_required'?'What kind of credential or work do you want to research?':result.error?.code==='summit_is_city_in_union_county'?'Choose the corrected New Jersey geography.':result.error?.code==='statewide_fallback_confirmation_required'?'Would you like to broaden this to statewide New Jersey credential records?':'Choose a source-backed research option.';
    session=touch({...session,phase,availableChoices:result.choices??[],availableRefinements:result.refinements,lastExecution:{source:'specialist',resultState:result.resultState,errorCode:result.error?.code,resultBearing:true,choicesBearing:hasChoices,executedAt:new Date().toISOString()},resultCount:result.total,nextAction:result.resultState==='SUPPORTED_RESULTS'||result.resultState==='EXACT_IDENTITY'?'Narrow these results or open a specialist profile.':hasChoices?choicePrompt:'Review the limitation and choose a useful next action.'});
  }
  return {session,result,diagnostics:{requestId,hub:session.hub,phase:session.phase,resultState:result?.resultState,latencyMs:Math.round(performance.now()-started),resultCount:result?.total??0,specialistCalls}};
}
