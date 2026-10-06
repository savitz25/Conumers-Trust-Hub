import type { GuidedAction, GuidedApiResponse, GuidedResearchSession, GuidedExecutionResult, GuidedPilotHub } from './contract.ts';
import { GUIDED_PILOT_HUBS } from './contract.ts';
import { createGuidedSession, parseLabeledIdentifier, refreshCareSession, CARE_CHOICES, INSURANCE_CHOICES, INVESTOR_CHOICES, LENDER_CHOICES, MOVE_CHOICES, parseGuidedGeography, geographyFromParsed, pushHistory, restorePrevious, TRADE_CHOICES, validateGuidedSession } from './session.ts';
import { parseNetworkAsk } from '../network/ask-parse.ts';
import {careLocation,initialCareRatingFilters,type CareSetting} from '../network/care-task.ts';
import {planAskResearch} from '../network/research-planner.ts';
import {validateAskQuestion} from '../network/ask-request.ts';
import { buildSeniorClassPreviewResult, executeGuidedSpecialist, isGuidedExecutionAuthorized } from './specialists.ts';
import { planRequiresImmediateClarification } from '../network/research-planner.ts';
import { resolveResearchScope } from '../network/research-scope.ts';
import { resolveGuidedNextActions } from '../network/guided-next-actions.ts';
import { mnIdentifier, mnRefusal, mnSpecialistUrl, mnCaveat } from '../network/mn-network.ts';
import { mdSpecialistUrl } from '../network/md-network.ts';
import { investorSecHandoff } from './state-handoff.ts';
import { wiSeniorStateResearch } from '../network/wi-network.ts';
import { msResearchHandoff, msCaveat } from '../network/ms-network.ts';
import { moResearchHandoff, moCaveat } from '../network/mo-network.ts';
import { okResearchHandoff, okCaveat } from '../network/ok-network.ts';
import { scResearchHandoff, scCaveat } from '../network/sc-network.ts';
import { alResearchHandoff, alCaveat } from '../network/al-network.ts';
import { kyResearchHandoff, kyCaveat } from '../network/ky-network.ts';

import { laResearchHandoff, laCaveat } from '../network/la-network.ts';
import { inResearchHandoff, inCaveat } from '../network/in-network.ts';
import { rewriteMoveSpecialistHref } from '../network/move-origin.ts';

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

// POST-R1-ASK-MULTIHUB-001: continuation for a validated `hub:${hubId}` selection out of the
// multi-hub CLARIFY state. Deliberately reuses each hub's own existing, already-shipped
// "which research mode?" entry prompt (the exact choice constants and nextAction text
// afterChoice's *_mode:explain branches already return) rather than re-deriving new routing --
// the session then continues through those same, already-tested branches for every subsequent
// click. Geography already resolved for the original question is carried over so a state/county
// the user already typed is not asked for a second time; nothing about a specific entity/trade/
// class is guessed, so an unexecutable request still correctly reaches the existing honest
// unsupported/clarification state via the normal downstream path.
function enterChosenHub(session: GuidedResearchSession, hubId: GuidedPilotHub): GuidedResearchSession {
  const parsed = parseNetworkAsk(session.originalQuestion);
  const geography = geographyFromParsed(parsed);
  const base = { ...session, hub: hubId, geography: geography ?? session.geography, availableChoices: [] as GuidedResearchSession['availableChoices'] };
  if (hubId === 'senior') {
    return { ...base, phase: 'CLARIFY', missingFields: ['providerClass'], availableChoices: CARE_CHOICES, nextAction: 'What kind of care are you looking for?' };
  }
  if (hubId === 'contractor') {
    return { ...base, phase: 'CLARIFY', missingFields: ['trade'], availableChoices: TRADE_CHOICES, nextAction: 'Tell us what kind of work you need.' };
  }
  if (hubId === 'move') {
    return { ...base, phase: 'CLARIFY', missingFields: ['moveMode'], availableChoices: MOVE_CHOICES, nextAction: 'What would you like to research?' };
  }
  if (hubId === 'investor') {
    return { ...base, phase: 'CLARIFY', missingFields: ['investorResearchMode'], availableChoices: INVESTOR_CHOICES, nextAction: 'Choose firm research, a CRD, or a specific firm name. Individual representatives are not published.' };
  }
  if (hubId === 'insurance') {
    return { ...base, phase: 'CLARIFY', missingFields: ['insuranceEntityClass'], availableChoices: INSURANCE_CHOICES, nextAction: 'Choose agency, legal insurer, producer, or an exact identifier.' };
  }
  return { ...base, phase: 'CLARIFY', missingFields: ['lenderResearchMode'], availableChoices: LENDER_CHOICES, nextAction: 'Choose property-market activity, a lender name, an identifier, or complaint evidence.' };
}

function afterChoice(session: GuidedResearchSession, value: string): GuidedResearchSession {
  const next = pushHistory(session);
  if(value.startsWith('scope_state:')){
    const stateCode=value.slice('scope_state:'.length);const requested=session.executionScope.normalizedRequestedGeography;
    if(!requested?.stateCode||requested.stateCode!==stateCode)throw new Error('invalid_scope_consent');
    const executionScope=resolveResearchScope(session.researchPlan,{approvedBroaderGeography:{kind:'state',display:requested.stateName??stateCode,stateCode,stateName:requested.stateName}});
    if(!executionScope.executionAllowed)throw new Error('invalid_scope_consent');
    return touch({...next,executionScope,researchPlan:{...session.researchPlan,executionAllowed:true,executionMode:'COHORT',missingSlots:[],clarificationReason:undefined,reasonCodes:[...session.researchPlan.reasonCodes,'EXPLICIT_SCOPE_CONSENT']},geography:{type:'state',value:stateCode,stateCode,stateName:requested.stateName,meaning:executionScope.executionGeographyMeaning},availableChoices:[],missingFields:[],phase:'EXECUTE',nextAction:'execute'});
  }
  if(value.startsWith('scope_place:')){
    if(session.executionScope.normalizedRequestedGeography?.kind!=='region')throw new Error('invalid_scope_selection');
    const selected=parseGuidedGeography(value.slice('scope_place:'.length));if(!selected?.stateCode)throw new Error('invalid_scope_selection');
    const executionGeography={kind:selected.type,display:selected.type==='city'?`${selected.city}, ${selected.stateName}`:selected.value,stateCode:selected.stateCode,stateName:selected.stateName,county:selected.county,city:selected.city};
    const executionScope={...session.executionScope,executionGeography,resolutionState:'DETERMINISTIC_EQUIVALENT' as const,transformation:'REGION_TO_COMPONENT' as const,executionAllowed:true,disclosureRequired:true,disclosure:`You asked for ${session.executionScope.requestedGeography?.display}. You selected ${executionGeography.display} for recorded-location research. Recorded location is not service territory.`,reasonCodes:[...session.executionScope.reasonCodes,'USER_SELECTED_REGION_COMPONENT']};
    return touch({...next,executionScope,researchPlan:{...session.researchPlan,executionAllowed:true,executionMode:'COHORT',missingSlots:[],clarificationReason:undefined,reasonCodes:[...session.researchPlan.reasonCodes,'USER_SELECTED_REGION_COMPONENT']},geography:selected,availableChoices:[],missingFields:[],phase:'EXECUTE',nextAction:'execute'});
  }
  if(value==='scope_other')return touch({...next,availableChoices:[],missingFields:['geography'],phase:'COLLECT',nextAction:'Enter another city or county in the requested area.'});
  // POST-R1-ASK-MULTIHUB-001: session.ts's candidateHubs.length>1 branch (base(), pre-existing
  // since commit 0b0b767, unrelated to Post-R1 intent work) renders SELECT_CHOICE options shaped
  // `hub:${hubId}` whenever a query touches more than one specialist area (e.g. "is state farm
  // licensed in texas", "electrician mortgage lender New Jersey") -- but no branch here ever
  // consumed that value format. Every hub-specific branch below requires session.hub to already
  // be set, which is never true in this multi-hub CLARIFY state (session.hub stays undefined by
  // design), so execution fell through to the catch-all `throw new Error('invalid_hub')` at the
  // bottom of this function, surfaced to the user as "The Guided Research action or session was
  // invalid." This is the fix: the chosen hub must be one this exact session actually offered
  // (session.researchPlan.candidateHubs, not just "some known hub id" and not just "some string
  // in availableChoices" -- both are checked) before the session is allowed to commit to it.
  if (value.startsWith('hub:')) {
    if (session.hub !== undefined) throw new Error('invalid_hub_selection');
    const hubId = value.slice('hub:'.length);
    const isKnownPilotHub = (GUIDED_PILOT_HUBS as readonly string[]).includes(hubId);
    const wasOfferedThisSession = (session.researchPlan.candidateHubs as readonly string[]).includes(hubId);
    const matchesAdvertisedChoice = session.availableChoices.some((c) => c.value === value);
    if (!isKnownPilotHub || !wasOfferedThisSession || !matchesAdvertisedChoice) throw new Error('invalid_hub_selection');
    return touch(enterChosenHub(next, hubId as GuidedPilotHub));
  }
  if (session.hub === 'senior') {
    if(session.researchPlan.reasonCodes.includes('CARE_TASK')){
      if(!session.availableChoices.some(c=>c.value===value))throw new Error('stale_or_invalid_choice');
      if(value==='explain_care')return touch({...next,nextAction:'Nursing homes provide facility-based records; Home Health and Hospice have separate CMS agency records. Assisted living uses state-specific sources. Choose a setting to continue.',phase:'CLARIFY'});
      return touch(refreshCareSession({...clearExecutionState(next),selectedFilters:initialCareRatingFilters(session.originalQuestion,value as CareSetting),identifier:undefined,identityName:undefined},value as CareSetting,session.geography));
    }
    if (value === 'explain_care') return touch({ ...next, phase: 'CLARIFY', missingFields: ['providerClass'], nextAction: 'Choose a care setting after reviewing the differences.' });
    // POST-R1-ASK-INTENT-001 Section G: CARE_CHOICES (session.ts) has always rendered
    // "Assisted living" and "Memory care" as clickable options here, but this non-CARE_TASK
    // branch only ever accepted nursing_home/home_health/hospice -- clicking a choice the
    // system itself just offered threw invalid_choice, which is exactly the "a valid
    // generated action invalidates its own session" defect. SeniorTrustHub's CMS Care
    // Compare source genuinely does not cover these two classes (same limitation already
    // encoded in senior-ask.ts's SENIOR_UNSOURCED_PROVIDER_CLASSES/seniorFailClosedReason),
    // so the fix is an honest terminal CLARIFY, not silently accepting an unexecutable class.
    if (value === 'assisted_living' || value === 'memory_care') {
      const label = value === 'assisted_living' ? 'Assisted Living' : 'Memory Care';
      return touch({
        ...next,
        phase: 'CLARIFY',
        missingFields: ['providerClass'],
        availableChoices: next.availableChoices.filter((c) => c.value !== 'assisted_living' && c.value !== 'memory_care'),
        nextAction: `${label} is licensed per-state and is not part of the CMS Care Compare data SeniorTrustHub currently sources (which covers Nursing Home, Home Health, and Hospice). A state-specific source would be required — this is not yet available. Choose a supported care setting, or search elsewhere for ${label.toLowerCase()}.`,
      });
    }
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
    const match=parseLabeledIdentifier(value.trim(),['USDOT','DOT','MC','CRD','NPN','NAIC','NMLS'],{anchored:true,leiSupported:true});
    if (!match) throw new Error('invalid_identifier');
    return touch({ ...next,identifier:match,missingFields:[],phase:'EXECUTE',nextAction:'execute' });
  }
  throw new Error('nothing_to_collect');
}

export async function orchestrateGuidedResearch(input: { session?: unknown; action: GuidedAction }): Promise<GuidedApiResponse> {
  if(!input||!input.action||!['START','SELECT_CHOICE','SET_GEOGRAPHY','SET_FILTER','CLEAR_FILTER','CLEAR_ALL_FILTERS','BACK','RESET','RESUME','EXECUTE'].includes(input.action.type))throw new Error('invalid_guided_action');
  if('value' in input.action&&(typeof input.action.value!=='string'||input.action.value.length>160))throw new Error('invalid_action_value');
  if(input.action.type==='START')validateAskQuestion(input.action.question);
  else validateAskQuestion((input.session as GuidedResearchSession|undefined)?.originalQuestion);
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
    const canonical=planAskResearch(session.originalQuestion);
    if(canonical.primaryHub&&session.hub!==canonical.primaryHub)throw new Error('session_domain_mismatch');
    if(canonical.reasonCodes.includes('CARE_TASK')){
      if(session.researchPlan.careSetting&&!['nursing_home','home_health','hospice','assisted_living','memory_care','independent_living'].includes(session.researchPlan.careSetting))throw new Error('invalid_care_setting');
      if(session.providerClass&&session.providerClass!==session.researchPlan.careSetting)throw new Error('session_class_mismatch');
      if(canonical.careSetting&&session.researchPlan.careSetting!==canonical.careSetting)throw new Error('session_class_mismatch');
      const original=canonical.requestedGeography,geo=session.geography;
      if(original?.city&&geo?.city?.toLowerCase()!==original.city.toLowerCase())throw new Error('session_city_mismatch');
      if(original?.stateCode&&geo?.stateCode!==original.stateCode)throw new Error('session_state_mismatch');
      session=refreshCareSession(session,session.researchPlan.careSetting,geo);
    }
    if (input.action.type==='SELECT_CHOICE') session=afterChoice(session,input.action.value);
    else if (input.action.type==='SET_GEOGRAPHY') {
      if(session.researchPlan.reasonCodes.includes('CARE_TASK')){
        const requested=session.researchPlan.requestedGeography;
        const value=input.action.value.trim();
        let geo=careLocation(`providers in ${value}`);
        if(geo?.kind==='state'&&requested?.city)geo={...geo,kind:'city',city:requested.city,display:`${requested.city}, ${geo.stateName}`};
        if(!geo||geo.resolution!=='RESOLVED'||!['city','state','county'].includes(geo.kind))throw new Error('invalid_care_location');
        if(requested?.stateCode&&geo.stateCode!==requested.stateCode)throw new Error('conflicting_care_state');
        if(requested?.city&&geo.city?.toLowerCase()!==requested.city.toLowerCase())throw new Error('conflicting_care_city');
        session=refreshCareSession(pushHistory(session),session.researchPlan.careSetting,{type:geo.kind as 'city'|'state'|'county',value:geo.city??geo.county??geo.stateCode!,city:geo.city,county:geo.county,stateCode:geo.stateCode,stateName:geo.stateName});
      }else session=collectValue(session,input.action.value);
    }
    else if (input.action.type==='SET_FILTER') { validateFilter(session,input.action.field,input.action.value);session=touch({ ...pushHistory(session),selectedFilters:{...session.selectedFilters,[input.action.field]:input.action.value},phase:'EXECUTE',nextAction:'execute' }); }
    else if (input.action.type==='CLEAR_FILTER') { if (!(input.action.field in session.selectedFilters)) throw new Error('invalid_filter_field');const filters={...session.selectedFilters};delete filters[input.action.field];session=touch({...pushHistory(session),selectedFilters:filters,phase:'EXECUTE',nextAction:'execute'}); }
    else if (input.action.type==='CLEAR_ALL_FILTERS') { if (!Object.keys(session.selectedFilters).length) throw new Error('no_active_filters');session=touch({...pushHistory(session),selectedFilters:{},phase:'EXECUTE',nextAction:'execute'}); }
    else if (input.action.type==='BACK') session=restorePrevious(session);
    else if (input.action.type==='RESET') session=createGuidedSession(session.originalQuestion)!;
  }
  let result:GuidedExecutionResult|undefined;
  if (session.hub === 'investor' && session.identifier?.type === 'SEC') {
    const secFileNumber = session.identifier.value;
    const handoff = investorSecHandoff(session.researchPlan.requestedGeography?.stateCode);
    const message = `A labeled SEC file number belongs to InvestorTrustHub. Continue at ${handoff.label} to verify it; Ask will not treat it as a CRD.`;
    session = touch({...session,phase:'DEEP_LINK',missingFields:[],availableChoices:[],nextAction:message});
    result = {specialist:'investor',executionOccurred:false,resultState:'UNSUPPORTED_CAPABILITY',consumerHeading:'Verify the SEC file number',consumerMessage:message,
      interpretation:[{label:'SEC file number',value:secFileNumber}],rows:[],total:0,refinements:[],provenance:{contract:'ask-sec-file-handoff-v1'},
      limitations:['Ask does not execute SEC file lookups as CRD lookups.'],destinations:[{type:'STATE_RESEARCH',href:handoff.href,label:`Open ${handoff.label}`}],latencyMs:0,firstUsefulResult:true,nextActions:[]};
    return {session,result,diagnostics:{requestId,hub:'investor',phase:session.phase,resultState:result.resultState,latencyMs:Math.round(performance.now()-started),resultCount:0,specialistCalls:0}};
  }
  const oklahoma=okResearchHandoff(session.researchPlan);
  if(oklahoma&&session.hub===oklahoma.hub){
    const message=`${okCaveat(oklahoma.hub)} Continue at ${oklahoma.label} Oklahoma. Ask has not retrieved a provider cohort.`;
    session=touch({...session,phase:'DEEP_LINK',missingFields:[],availableChoices:[],nextAction:message});
    result={specialist:oklahoma.hub,executionOccurred:false,resultState:'UNSUPPORTED_CAPABILITY',consumerHeading:`Oklahoma ${oklahoma.label} research`,consumerMessage:message,
      interpretation:[{label:'Research geography',value:'Oklahoma statewide'},...(session.identifier?[{label:session.identifier.type,value:session.identifier.value}]:[])],
      rows:[],total:0,refinements:[],provenance:{contract:'ath-ok-network-release-v1'},
      limitations:['Ask is a state research gateway; no specialist rows were retrieved or copied.'],
      destinations:[{type:'STATE_RESEARCH',href:oklahoma.href,label:`Open ${oklahoma.label} Oklahoma`}],latencyMs:0,firstUsefulResult:true,nextActions:[]};
    return {session,result,diagnostics:{requestId,hub:oklahoma.hub,phase:session.phase,resultState:result.resultState,latencyMs:Math.round(performance.now()-started),resultCount:0,specialistCalls:0}};
  }
  const missouri=moResearchHandoff(session.researchPlan);
  if(missouri&&session.hub===missouri.hub){
    const message=`${moCaveat(missouri.hub)} Continue at ${missouri.label} Missouri. Ask has not retrieved a provider cohort.`;
    session=touch({...session,phase:'DEEP_LINK',missingFields:[],availableChoices:[],nextAction:message});
    result={specialist:missouri.hub,executionOccurred:false,resultState:'UNSUPPORTED_CAPABILITY',consumerHeading:`Missouri ${missouri.label} research`,consumerMessage:message,
      interpretation:[{label:'Research geography',value:'Missouri statewide'},...(session.identifier?[{label:session.identifier.type,value:session.identifier.value}]:[])],
      rows:[],total:0,refinements:[],provenance:{contract:'ath-mo-network-release-v1'},
      limitations:['Ask is a state research gateway; no specialist rows were retrieved or copied.'],
      destinations:[{type:'STATE_RESEARCH',href:missouri.href,label:`Open ${missouri.label} Missouri`}],latencyMs:0,firstUsefulResult:true,nextActions:[]};
    return {session,result,diagnostics:{requestId,hub:missouri.hub,phase:session.phase,resultState:result.resultState,latencyMs:Math.round(performance.now()-started),resultCount:0,specialistCalls:0}};
  }
  const mississippi=msResearchHandoff(session.researchPlan);
  if(mississippi&&session.hub===mississippi.hub){
    const city=session.researchPlan.requestedGeography?.city;
    const message=`${msCaveat(mississippi.hub,session.originalQuestion)} ${city?`${city} is context only; no city or county page was executed. `:''}Continue at ${mississippi.label} Mississippi. Ask has not retrieved a provider cohort.`;
    session=touch({...session,phase:'DEEP_LINK',missingFields:[],availableChoices:[],nextAction:message});
    result={specialist:mississippi.hub,executionOccurred:false,resultState:'UNSUPPORTED_CAPABILITY',consumerHeading:`Mississippi ${mississippi.label} research`,consumerMessage:message,
      interpretation:[{label:'Research geography',value:'Mississippi statewide'},...(session.identifier?[{label:session.identifier.type,value:session.identifier.value}]:[])],
      rows:[],total:0,refinements:[],provenance:{contract:'ath-ms-network-release-v1'},
      limitations:['Ask is a state research gateway; no specialist rows were retrieved or copied.'],
      destinations:[{type:'STATE_RESEARCH',href:mississippi.href,label:`Open ${mississippi.label} Mississippi`}],latencyMs:0,firstUsefulResult:true,nextActions:[]};
    return {session,result,diagnostics:{requestId,hub:mississippi.hub,phase:session.phase,resultState:result.resultState,latencyMs:Math.round(performance.now()-started),resultCount:0,specialistCalls:0}};
  }
  const southCarolina=scResearchHandoff(session.researchPlan);
  if(southCarolina&&session.hub===southCarolina.hub){
    const city=session.researchPlan.requestedGeography?.city;
    const message=`${scCaveat(southCarolina.hub,session.originalQuestion)} ${city?`${city} is context only; no city or county page was executed. `:''}Continue at ${southCarolina.label} South Carolina. Ask has not retrieved a provider cohort.`;
    session=touch({...session,phase:'DEEP_LINK',missingFields:[],availableChoices:[],nextAction:message});
    result={specialist:southCarolina.hub,executionOccurred:false,resultState:'UNSUPPORTED_CAPABILITY',consumerHeading:`South Carolina ${southCarolina.label} research`,consumerMessage:message,
      interpretation:[{label:'Research geography',value:'South Carolina statewide'},...(session.identifier?[{label:session.identifier.type,value:session.identifier.value}]:[])],
      rows:[],total:0,refinements:[],provenance:{contract:'ath-sc-network-release-v1'},
      limitations:['Ask is a state research gateway; no specialist rows were retrieved or copied.'],
      destinations:[{type:'STATE_RESEARCH',href:southCarolina.href,label:`Open ${southCarolina.label} South Carolina`}],latencyMs:0,firstUsefulResult:true,nextActions:[]};
    return {session,result,diagnostics:{requestId,hub:southCarolina.hub,phase:session.phase,resultState:result.resultState,latencyMs:Math.round(performance.now()-started),resultCount:0,specialistCalls:0}};
  }
  const alabama=alResearchHandoff(session.researchPlan);
  if(alabama&&session.hub===alabama.hub){
    const city=session.researchPlan.requestedGeography?.city;
    const message=`${alCaveat(alabama.hub,session.originalQuestion)} ${city?`${city} is context only; no city or county page was executed. `:''}Continue at ${alabama.label} Alabama. Ask has not retrieved a provider cohort.`;
    session=touch({...session,phase:'DEEP_LINK',missingFields:[],availableChoices:[],nextAction:message});
    result={specialist:alabama.hub,executionOccurred:false,resultState:'UNSUPPORTED_CAPABILITY',consumerHeading:`Alabama ${alabama.label} research`,consumerMessage:message,
      interpretation:[{label:'Research geography',value:'Alabama statewide'},...(session.identifier?[{label:session.identifier.type,value:session.identifier.value}]:[])],
      rows:[],total:0,refinements:[],provenance:{contract:'ath-al-network-release-v1'},
      limitations:['Ask is a state research gateway; no specialist rows were retrieved or copied.'],
      destinations:[{type:'STATE_RESEARCH',href:alabama.href,label:`Open ${alabama.label} Alabama`}],latencyMs:0,firstUsefulResult:true,nextActions:[]};
    return {session,result,diagnostics:{requestId,hub:alabama.hub,phase:session.phase,resultState:result.resultState,latencyMs:Math.round(performance.now()-started),resultCount:0,specialistCalls:0}};
  }
  const kentucky=kyResearchHandoff(session.researchPlan);
  if(kentucky&&session.hub===kentucky.hub){
    const city=session.researchPlan.requestedGeography?.city;
    const message=`${kyCaveat(kentucky.hub,session.originalQuestion)} ${city?`${city} is context only; no city or county page was executed. `:''}Continue at ${kentucky.label} Kentucky. Ask has not retrieved a provider cohort.`;
    session=touch({...session,phase:'DEEP_LINK',missingFields:[],availableChoices:[],nextAction:message});
    result={specialist:kentucky.hub,executionOccurred:false,resultState:'UNSUPPORTED_CAPABILITY',consumerHeading:`Kentucky ${kentucky.label} research`,consumerMessage:message,
      interpretation:[{label:'Research geography',value:'Kentucky statewide'},...(session.identifier?[{label:session.identifier.type,value:session.identifier.value}]:[])],
      rows:[],total:0,refinements:[],provenance:{contract:'ath-ky-network-release-v1'},
      limitations:['Ask is a state research gateway; no specialist rows were retrieved or copied.'],
      destinations:[{type:'STATE_RESEARCH',href:kentucky.href,label:`Open ${kentucky.label} Kentucky`}],latencyMs:0,firstUsefulResult:true,nextActions:[]};
    return {session,result,diagnostics:{requestId,hub:kentucky.hub,phase:session.phase,resultState:result.resultState,latencyMs:Math.round(performance.now()-started),resultCount:0,specialistCalls:0}};
  }
  const louisiana=laResearchHandoff(session.researchPlan);
  if(louisiana&&session.hub===louisiana.hub){
    const city=session.researchPlan.requestedGeography?.city;
    const message=`${laCaveat(louisiana.hub,session.originalQuestion)} ${city?`${city} is context only; no city or parish page was executed. `:''}Continue at ${louisiana.label} Louisiana. Ask has not retrieved a provider cohort.`;
    session=touch({...session,phase:'DEEP_LINK',missingFields:[],availableChoices:[],nextAction:message});
    result={specialist:louisiana.hub,executionOccurred:false,resultState:'UNSUPPORTED_CAPABILITY',consumerHeading:`Louisiana ${louisiana.label} research`,consumerMessage:message,
      interpretation:[{label:'Research geography',value:'Louisiana statewide'},...(session.identifier?[{label:session.identifier.type,value:session.identifier.value}]:[])],
      rows:[],total:0,refinements:[],provenance:{contract:'ath-la-network-release-v1'},
      limitations:['Ask is a state research gateway; no specialist rows were retrieved or copied.'],
      destinations:[{type:'STATE_RESEARCH',href:louisiana.href,label:`Open ${louisiana.label} Louisiana`}],latencyMs:0,firstUsefulResult:true,nextActions:[]};
    return {session,result,diagnostics:{requestId,hub:louisiana.hub,phase:session.phase,resultState:result.resultState,latencyMs:Math.round(performance.now()-started),resultCount:0,specialistCalls:0}};
  }
  const indiana=inResearchHandoff(session.researchPlan);
  if(indiana&&session.hub===indiana.hub){
    const city=session.researchPlan.requestedGeography?.city;
    const message=`${inCaveat(indiana.hub,session.originalQuestion)} ${city?`${city} is context only; no city provider search or city page was executed. `:''}Continue at ${indiana.label} Indiana. Ask has not retrieved a provider cohort.`;
    session=touch({...session,phase:'DEEP_LINK',missingFields:[],availableChoices:[],nextAction:message});
    result={specialist:indiana.hub,executionOccurred:false,resultState:'UNSUPPORTED_CAPABILITY',consumerHeading:`Indiana ${indiana.label} research`,consumerMessage:message,
      interpretation:[{label:'Research geography',value:'Indiana statewide'},...(session.identifier?[{label:session.identifier.type,value:session.identifier.value}]:[])],
      rows:[],total:0,refinements:[],provenance:{contract:'ath-in-network-release-v1'},
      limitations:['Ask is a state research gateway; no specialist rows were retrieved or copied.'],
      destinations:[{type:'STATE_RESEARCH',href:indiana.href,label:`Open ${indiana.label} Indiana`}],latencyMs:0,firstUsefulResult:true,nextActions:[]};
    return {session,result,diagnostics:{requestId,hub:indiana.hub,phase:session.phase,resultState:result.resultState,latencyMs:Math.round(performance.now()-started),resultCount:0,specialistCalls:0}};
  }
  const wiSenior=wiSeniorStateResearch(session.researchPlan);
  if(session.hub==='senior'&&wiSenior){
    const city=session.researchPlan.requestedGeography?.city;
    const message=`Wisconsin statewide ${wiSenior.label} evidence is available at SeniorTrustHub Wisconsin. ${city?`${city} is context only; no city provider search or city page was executed. `:''}Continue at the Wisconsin research page. Ask has not retrieved a provider cohort.`;
    session=touch({...session,phase:'DEEP_LINK',missingFields:[],availableChoices:[],nextAction:message});
    result={specialist:'senior',executionOccurred:false,resultState:'UNSUPPORTED_CAPABILITY',consumerHeading:`Wisconsin ${wiSenior.label} research`,consumerMessage:message,
      interpretation:[{label:'Requested class',value:wiSenior.label},{label:'Research geography',value:'Wisconsin statewide'},...(session.identifier?.type==='CCN'?[{label:'CCN',value:session.identifier.value}]:[])],
      rows:[],total:0,refinements:[],provenance:{contract:'ath-wi-network-release-v1'},
      limitations:['Ask is a state research gateway; no provider records were retrieved or copied.'],
      destinations:[{type:'STATE_RESEARCH',href:wiSenior.href,label:'Open SeniorTrustHub Wisconsin'}],latencyMs:0,firstUsefulResult:true,nextActions:[]};
    return {session,result,diagnostics:{requestId,hub:'senior',phase:session.phase,resultState:result.resultState,latencyMs:Math.round(performance.now()-started),resultCount:0,specialistCalls:0}};
  }
  const mnPlan = planAskResearch(session.originalQuestion);
  if (mnPlan.reasonCodes.includes('MINNESOTA_RESEARCH_ROUTING') || mnPlan.reasonCodes.includes('MINNESOTA_SAFETY_REFUSAL') || mnIdentifier(session.originalQuestion)) {
    const refusal = mnRefusal(session.originalQuestion);
    const hub = mnPlan.primaryHub;
    const message = refusal ?? (hub ? mnCaveat(hub) : 'Choose a Minnesota specialist on the state gateway.');
    session = touch({...session, researchPlan:mnPlan, phase:refusal?'CLARIFY':'DEEP_LINK', availableChoices:[], availableRefinements:[], nextActions:[], nextAction:message});
    if (hub) result = {specialist:hub, executionOccurred:false, resultState:refusal?'INVALID_QUERY':'UNSUPPORTED_CAPABILITY', consumerHeading:refusal?'Clarify this research request':'Continue at the Minnesota specialist', consumerMessage:message, interpretation:mnPlan.identifier?[{label:mnPlan.identifier.type,value:mnPlan.identifier.value}]:[], rows:[], total:0, refinements:[], provenance:{contract:'ath-mn-network-release-v1'}, limitations:['Ask is a gateway. No specialist records were retrieved or copied.'], destinations:refusal?[]:[{type:'STATE_RESEARCH',href:mnSpecialistUrl(hub),label:'Open Minnesota research'}], latencyMs:0, firstUsefulResult:true, nextActions:[]};
    return {session,result,diagnostics:{requestId,hub,phase:session.phase,resultState:result?.resultState,latencyMs:Math.round(performance.now()-started),resultCount:0,specialistCalls:0}};
  }
  if (session.hub === 'senior' && session.entityClass === 'assisted_living' && session.researchPlan.requestedGeography?.stateCode === 'MD') {
    const href = mdSpecialistUrl('senior');
    const message = 'Maryland has statewide Assisted Living Program evidence at SeniorTrustHub. Continue there to research that licensed class. Ask has not retrieved a provider cohort or made a city-level claim.';
    session = touch({...session, phase:'DEEP_LINK', missingFields:[], availableChoices:[], nextAction:message});
    result = {specialist:'senior', executionOccurred:false, resultState:'UNSUPPORTED_CAPABILITY', consumerHeading:'Maryland assisted living research', consumerMessage:message,
      interpretation:[{label:'Requested class',value:'Assisted Living Programs'},{label:'Research geography',value:'Maryland statewide'}], rows:[],total:0,refinements:[],
      provenance:{contract:'ath-md-network-release-v1'},limitations:['Ask is a gateway; no provider records were retrieved or copied.'],
      destinations:[{type:'STATE_RESEARCH',href,label:'Open Maryland assisted living research'}],latencyMs:0,firstUsefulResult:true,nextActions:[]};
    return {session,result,diagnostics:{requestId,hub:'senior',phase:session.phase,resultState:result.resultState,latencyMs:Math.round(performance.now()-started),resultCount:0,specialistCalls:0}};
  }
  const shouldRestoreResults = (input.action.type === 'RESUME' || input.action.type === 'BACK') && (session.phase === 'REFINE' || session.phase === 'ERROR_RECOVERY' || session.phase === 'CLARIFY' && Boolean(session.lastExecution));
  const executionRequested = session.phase==='EXECUTE' || input.action.type==='EXECUTE' || shouldRestoreResults;
  if (executionRequested && !session.researchPlan.executionAllowed && !planRequiresImmediateClarification(session.researchPlan)) {
    session=touch({...session,researchPlan:{...session.researchPlan,executionAllowed:true,executionMode:session.identifier?'IDENTIFIER':session.identityName?'IDENTITY':'COHORT',missingSlots:[],clarificationReason:undefined,reasonCodes:[...session.researchPlan.reasonCodes,'USER_CLARIFICATION_COMPLETED']}});
  }
  const specialistCapabilityCheck=(session.hub==='contractor'&&session.executionScope.requestedGeographyMeaning==='SERVICE_TERRITORY')||(session.hub==='insurance'&&session.insuranceResearchMode==='local_directory_handoff');
  if (executionRequested && !session.executionScope.executionAllowed&&!specialistCapabilityCheck) {
    session=touch({...session,phase:'CLARIFY',nextAction:session.executionScope.disclosure??'The requested scope cannot be executed safely.'});
    if(['move','investor','insurance','lender'].includes(session.hub??'')&&['SERVICE_TERRITORY','ORIGIN_DESTINATION'].includes(session.executionScope.requestedGeographyMeaning??''))result={specialist:session.hub!,resultState:'UNSUPPORTED_CAPABILITY' as const,consumerHeading:'Requested scope is not executable',consumerMessage:session.executionScope.disclosure??'The accepted source cannot establish service territory or route availability from recorded location.',interpretation:[{label:'Requested geography',value:session.executionScope.requestedGeography?.display??'Requested route'}],rows:[],total:0,refinements:[],provenance:{contract:'ask-execution-scope-v1'},limitations:['Service territory and route availability are not source-backed by recorded location or regulatory authority.'],destinations:session.hub==='move'?[{type:'VERIFY' as const,href:rewriteMoveSpecialistHref('https://www.movetrusthub.com/verify-dot'),label:'Verify a USDOT or MC'},{type:'DIRECTORY' as const,href:rewriteMoveSpecialistHref('https://www.movetrusthub.com/companies'),label:'Research recorded headquarters'}]:[],error:{code:'requested_scope_not_executable',retryable:false},latencyMs:0,firstUsefulResult:true};
  } else if (executionRequested && !session.researchPlan.executionAllowed) {
    session=touch({...session,phase:'CLARIFY',nextAction:session.researchPlan.clarificationReason??'Clarify the research request before specialist execution.'});
  } else if (executionRequested) {
    validateSelectedFilters(session);
    if(!isGuidedExecutionAuthorized(session))throw new Error('execution_not_authorized');
    specialistCalls=1;
    // TH-DISCOVERY-RESET-001: preserve any non-blocking narrowing choices session.ts already
    // attached before execution (e.g. Tampa Bay's Tampa/St. Petersburg/Clearwater sub-areas on an
    // auto-broadened result) -- these must survive alongside real results, not be wiped out by
    // result.choices (which drives CLARIFY vs REFINE below and is empty for an ordinary
    // SUPPORTED_RESULTS response).
    const preExecutionChoices=session.executionScope.reasonCodes.includes('AUTOMATIC_BROADENING')?session.availableChoices:[];
    result={...await executeGuidedSpecialist(session),executionOccurred:true};
    const hasChoices=Boolean(result.choices?.length);
    const phase=result.resultState==='BACKEND_UNAVAILABLE'||result.resultState==='TIMEOUT'?'ERROR_RECOVERY':hasChoices?'CLARIFY':'REFINE';
    const choicePrompt=result.error?.code==='new_jersey_credential_class_required'?'What kind of credential or work do you want to research?':result.error?.code==='summit_is_city_in_union_county'?'Choose the corrected New Jersey geography.':result.error?.code==='statewide_fallback_confirmation_required'?'Would you like to broaden this to statewide New Jersey credential records?':'Choose a source-backed research option.';
    session=touch({...session,phase,availableChoices:hasChoices?result.choices!:preExecutionChoices,availableRefinements:result.refinements,lastExecution:{source:'specialist',resultState:result.resultState,errorCode:result.error?.code,resultBearing:true,choicesBearing:hasChoices,executedAt:new Date().toISOString()},resultCount:result.total,nextAction:result.resultState==='SUPPORTED_RESULTS'||result.resultState==='EXACT_IDENTITY'?'Narrow these results or open a specialist profile.':hasChoices?choicePrompt:'Review the limitation and choose a useful next action.'});
  }
  if(!result&&session.researchPlan.reasonCodes.includes('CARE_TASK')&&session.researchPlan.careSetting&&!session.missingFields.length&&(!session.researchPlan.executionAllowed||!session.executionScope.executionAllowed)){
    result={specialist:'senior',executionOccurred:false,resultState:'UNSUPPORTED_CAPABILITY' as const,consumerHeading:'This care setting or scope needs a different source',consumerMessage:session.researchPlan.clarificationReason??session.executionScope.disclosure??'This combination is not supported by the accepted source.',interpretation:[{label:'Requested care setting',value:session.entityClass??'Not selected'},{label:'Requested location',value:session.researchPlan.requestedGeography?.display??'Not selected'},{label:'Execution',value:'No provider retrieval ran.'}],rows:[],total:0,refinements:[],provenance:{contract:'ask-execution-scope-v1'},limitations:['No nursing-home or other provider cohort was substituted.'],destinations:[],error:{code:'care_capability_unavailable',retryable:false},latencyMs:0,firstUsefulResult:true};
  }
  // TH-DISCOVERY-RESET-001C: "senior care Florida" is a genuine class ambiguity (Nursing Home vs.
  // Home Health vs. Hospice) that must keep asking which one -- but the class-choice clarification
  // above never called the specialist at all, so real providers that already exist for the
  // requested geography were invisible until a class was picked (a second click just to see
  // providers). Once a real geography is resolved, fetch the same real per-class previews
  // SeniorTrustHub's own /ask already shows directly, so they render on this same clarification
  // screen. Nursing Home / Home Health / Hospice stay in separate, clearly labeled sections --
  // never merged into one generic universe. buildSeniorClassPreviewResult is shared with the
  // server-rendered first paint (app/ask/page.tsx) so this in-place path (e.g. after "explain the
  // differences") stays consistent with it.
  if(!result){
    const seniorPreview=await buildSeniorClassPreviewResult(session);
    if(seniorPreview){
      result=seniorPreview;
      specialistCalls=seniorPreview.classPreviews?.length??0;
      session=touch({...session,lastExecution:{source:'specialist',resultState:seniorPreview.resultState,resultBearing:true,choicesBearing:true,executedAt:new Date().toISOString()},resultCount:result.total});
    }
  }
  let nextActions=resolveGuidedNextActions({plan:session.researchPlan,scope:session.executionScope,resultState:result?.resultState});
  if(session.researchPlan.reasonCodes.includes('CARE_TASK')&&session.researchPlan.executionAllowed&&session.providerClass&&session.geography){
    const filters=Object.entries(session.selectedFilters);
    if(filters.length>1){nextActions=nextActions.filter(a=>a.id!=='senior.search');if(result)result.limitations.push('Combined rating filters are preserved in this inline research. Open an individual profile or edit the filters before continuing a native search.');}
    else {
      const names={nursing_home:'Nursing homes',home_health:'Home health agencies',hospice:'Hospice providers'};
      const metricNames:Record<string,string>={overallStars:'overall',staffingStars:'staffing',inspectionStars:'inspection',qpcStars:'Quality of Patient Care'};
      const rating=filters.length?` with ${filters[0][1]}-star ${metricNames[filters[0][0]]} rating`:'';
      const q=`${names[session.providerClass]} in ${session.researchPlan.requestedGeography!.display}${rating}`;
      nextActions=nextActions.map(a=>a.id==='senior.search'?{...a,href:`https://www.seniortrusthub.com/ask?${new URLSearchParams({q,class:session.providerClass!,state:session.geography!.stateCode!})}`}:a);
    }
  }
  session=touch({...session,nextActions});
  if(session.hub==='insurance'&&session.researchPlan.intent==='HOW_TO'&&session.researchPlan.entityClass?.id==='insurance_producer')session=touch({...session,nextAction:'InsuranceTrustHub does not publish mass individual-producer profiles. Verify the producer through the applicable official state licensing source.'});
  // TH-DISCOVERY-003: "verify moving company before I book" is a verification-workflow question,
  // not a request to browse the mover directory -- give the same concrete next-step guidance the
  // nextActions below already assemble (identify the company, verify its USDOT/MC, or use the
  // official FMCSA source) instead of the generic "needs explanation" clarification message.
  if(session.hub==='move'&&session.researchPlan.intent==='HOW_TO'&&session.researchPlan.entityClass?.id==='mover')session=touch({...session,nextAction:'To verify a moving company before booking: identify the exact company name, look up its USDOT/MC number, and inspect its recorded FMCSA authority and role (carrier, broker, or both) before you commit.'});
  if(session.hub==='contractor'&&session.researchPlan.intent==='HOW_TO'&&session.researchPlan.entityClass?.id==='contractor')session=touch({...session,nextAction:'To verify a contractor before you hire them: identify the exact company name, look up its license/credential number, and inspect its recorded trade class, status, and jurisdiction before you commit.'});
  if(result)result={...result,nextActions};
  return {session,result,diagnostics:{requestId,hub:session.hub,phase:session.phase,resultState:result?.resultState,latencyMs:Math.round(performance.now()-started),resultCount:result?.total??0,specialistCalls}};
}
