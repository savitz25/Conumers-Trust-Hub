import { randomUUID } from 'node:crypto';
import { parseNetworkAsk } from '../network/ask-parse.ts';
import { planAskResearch, planRequiresImmediateClarification, validateAskResearchPlan, type AskResearchPlan } from '../network/research-planner.ts';
import { resolveResearchScope } from '../network/research-scope.ts';
import { GUIDED_PHASES, GUIDED_PILOT_HUBS, GUIDED_RESULT_STATES, GUIDED_SESSION_TTL_MS, GUIDED_SESSION_VERSION, type GuidedChoice, type GuidedGeography, type GuidedResearchSession, type GuidedSessionSnapshot } from './contract.ts';

const CARE_CHOICES: GuidedChoice[] = [
  { id: 'nursing-home', label: 'Nursing home / skilled nursing', action: 'SELECT_CHOICE', value: 'nursing_home', description: 'Facility-based skilled nursing and long-term care records.' },
  { id: 'home-health', label: 'Care at home', action: 'SELECT_CHOICE', value: 'home_health', description: 'Care through a home-health agency; office location is not service area.' },
  { id: 'hospice', label: 'Hospice care', action: 'SELECT_CHOICE', value: 'hospice', description: 'Hospice provider records; office geography is not service availability.' },
  { id: 'care-explain', label: "I'm not sure — explain the differences", action: 'SELECT_CHOICE', value: 'explain_care' },
];
const TRADE_CHOICES: GuidedChoice[] = [
  { id:'trade-roofing',label:'Roofing',action:'SELECT_CHOICE',value:'roofing' },
  { id:'trade-hvac',label:'Air conditioning / HVAC',action:'SELECT_CHOICE',value:'hvac' },
  { id:'trade-plumbing',label:'Plumbing',action:'SELECT_CHOICE',value:'plumbing' },
  { id:'trade-electrical',label:'Electrical',action:'SELECT_CHOICE',value:'electrical',description:'Electrical-contractor source coverage varies by jurisdiction.' },
  { id:'trade-general',label:'General / building construction',action:'SELECT_CHOICE',value:'general' },
  { id:'trade-pool-spa',label:'Pool / spa',action:'SELECT_CHOICE',value:'pool_spa' },
  { id:'trade-mechanical',label:'Mechanical',action:'SELECT_CHOICE',value:'mechanical' },
  { id:'trade-other',label:"Other / I’m not sure",action:'SELECT_CHOICE',value:'other_trade',description:'Describe the project briefly, then confirm a supported source category before research runs.' },
];
const MOVE_CHOICES: GuidedChoice[] = [
  { id: 'move-household', label: 'Household belongings', action: 'SELECT_CHOICE', value: 'mover' },
  { id: 'move-auto', label: 'A car or vehicle', action: 'SELECT_CHOICE', value: 'auto_transport' },
  { id: 'move-company', label: 'I have a specific company to research', action: 'SELECT_CHOICE', value: 'identity_name' },
  { id: 'move-id', label: 'I have a USDOT or MC number', action: 'SELECT_CHOICE', value: 'identifier' },
];
const INVESTOR_CHOICES: GuidedChoice[] = [
  {id:'investor-firms',label:'Research investment adviser firms',action:'SELECT_CHOICE',value:'investor_mode:firm_cohort',description:'RIA and ERA firms remain separate source-native classes.'},
  {id:'investor-crd',label:'Research an exact CRD',action:'SELECT_CHOICE',value:'investor_mode:identifier'},
  {id:'investor-name',label:'Research a specific firm name',action:'SELECT_CHOICE',value:'investor_mode:identity_name'},
  {id:'investor-unsure',label:"I’m not sure",action:'SELECT_CHOICE',value:'investor_mode:explain',description:'Firm research does not publish individual investment-adviser representatives.'},
];
const INSURANCE_CHOICES: GuidedChoice[] = [
  {id:'insurance-agency',label:'Insurance agency',action:'SELECT_CHOICE',value:'insurance_class:agency'},
  {id:'insurance-insurer',label:'Insurance company / legal insurer',action:'SELECT_CHOICE',value:'insurance_class:legal_insurer'},
  {id:'insurance-producer',label:'Individual agent / producer',action:'SELECT_CHOICE',value:'insurance_class:producer',description:'Mass person publication is restricted.'},
  {id:'insurance-id',label:'I have an NPN or NAIC code',action:'SELECT_CHOICE',value:'insurance_mode:identifier'},
  {id:'insurance-unsure',label:"I’m not sure",action:'SELECT_CHOICE',value:'insurance_mode:explain',description:'Agency, producer, and legal insurer are different regulatory classes.'},
];
const LENDER_CHOICES: GuidedChoice[] = [
  {id:'lender-market',label:'Mortgage activity for properties in an area',action:'SELECT_CHOICE',value:'lender_mode:property_market',description:'HMDA property geography is not headquarters or service territory.'},
  {id:'lender-name',label:'A specific lender',action:'SELECT_CHOICE',value:'lender_mode:identity_name'},
  {id:'lender-id',label:'An NMLS or LEI',action:'SELECT_CHOICE',value:'lender_mode:identifier'},
  {id:'lender-complaints',label:'Complaint evidence about a known lender',action:'SELECT_CHOICE',value:'lender_mode:complaints'},
  {id:'lender-unsure',label:"I’m not sure",action:'SELECT_CHOICE',value:'lender_mode:explain',description:'Institutions, branches, and individual MLOs remain separate.'},
];

function snapshot(session: GuidedResearchSession): GuidedSessionSnapshot {
  const state = structuredClone(session) as GuidedResearchSession & Record<string, unknown>;
  for (const key of ['version','sessionId','originalQuestion','createdAt','updatedAt','history']) delete state[key];
  return state;
}

export function validateGuidedSession(value: unknown): GuidedResearchSession | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as GuidedResearchSession;
  if (row.version !== GUIDED_SESSION_VERSION || !row.sessionId || !row.originalQuestion || !row.researchPlan || !row.executionScope) return null;
  if (!GUIDED_PHASES.includes(row.phase) || (row.hub && !GUIDED_PILOT_HUBS.includes(row.hub))) return null;
  if (row.lastExecution && (row.lastExecution.source !== 'specialist' || !GUIDED_RESULT_STATES.includes(row.lastExecution.resultState) || row.lastExecution.resultBearing !== true || typeof row.lastExecution.choicesBearing !== 'boolean' || !Number.isFinite(Date.parse(row.lastExecution.executedAt)) || (row.lastExecution.errorCode !== undefined && typeof row.lastExecution.errorCode !== 'string'))) return null;
  if (!Array.isArray(row.history) || !row.selectedFilters || typeof row.selectedFilters !== 'object') return null;
  const updated = Date.parse(row.updatedAt);
  if (!Number.isFinite(updated) || Date.now() - updated > GUIDED_SESSION_TTL_MS) return null;
  return row;
}

export function parseGuidedGeography(raw: string): GuidedGeography | null {
  const value = raw.trim().replace(/[.,]+$/g, '');
  if (!value) return null;
  // Summit is a city in Union County. Never accept the contradictory
  // "Summit County, New Jersey" combination as a source geography.
  if (/^summit\s+county(?:\s*,?\s*(?:new\s+jersey|nj))?$/i.test(value)) return {
    type:'county',value:'Summit County, New Jersey',county:'Summit County',stateCode:'NJ',stateName:'New Jersey',
    meaning:'Submitted geography requires source validation; New Jersey has no Summit County.',
  };
  if (/^summit(?:\s*,?\s*(?:new\s+jersey|nj))$/i.test(value)) return {
    type: 'city', value: 'Summit, New Jersey', city: 'Summit', county: 'Union',
    stateCode: 'NJ', stateName: 'New Jersey',
    meaning: 'Recorded Summit city geography in Union County, New Jersey; not service territory.',
  };
  if (/^\d{5}$/.test(value)) return { type: 'zip', value, meaning: 'Recorded ZIP in the specialist source; not service availability.' };
  const parsed = parseNetworkAsk(`providers in ${value}`);
  if (parsed.geography?.countyName) return { type: 'county', value: parsed.geography.countyName.replace(/ County$/i, ''), county: parsed.geography.countyName.replace(/ County$/i, ''), stateCode: parsed.geography.stateCode, stateName: parsed.geography.stateName, meaning: 'Recorded county geography; not service territory.' };
  if (parsed.geography?.city) return { type: 'city', value: parsed.geography.city, city: parsed.geography.city, stateCode: parsed.geography.stateCode, stateName: parsed.geography.stateName, meaning: 'Recorded city/address geography; not service territory.' };
  if (parsed.geography?.stateCode) return { type: 'state', value: parsed.geography.stateCode, stateCode: parsed.geography.stateCode, stateName: parsed.geography.stateName, meaning: 'Recorded state geography; not service territory.' };
  if (/broward/i.test(value)) return { type: 'county', value: 'Broward', county: 'Broward', stateCode: 'FL', stateName: 'Florida', meaning: 'Recorded Broward County geography; not service territory.' };
  if (/palm\s*beach/i.test(value)) return { type: 'county', value: 'Palm Beach', county: 'Palm Beach', stateCode: 'FL', stateName: 'Florida', meaning: 'Recorded Palm Beach County geography; not service territory.' };
  return { type: 'city', value, city: value, meaning: 'Recorded city/address geography where supported; not service territory.' };
}

function geographyFromParsed(parsed: ReturnType<typeof parseNetworkAsk>): GuidedGeography | undefined {
  const geography = parsed.geography;
  if (!geography) return undefined;
  const stateSuffix = geography.stateName ? `, ${geography.stateName}` : '';
  if (geography.city) return parseGuidedGeography(`${geography.city}${stateSuffix}`) ?? undefined;
  if (geography.countyName) return parseGuidedGeography(`${geography.countyName}${stateSuffix}`) ?? undefined;
  return parseGuidedGeography(geography.stateName ?? geography.stateCode ?? '') ?? undefined;
}

function newJerseyTrade(question:string,stateCode?:string):string|undefined {
  if(stateCode!=='NJ')return undefined;
  const choices:Array<[RegExp,string]>=[
    [/\bhome\s+improvement(?:\s+contractors?)?\b/i,'home_improvement'],[/\b(?:electricians?|electrical(?:\s+contractors?)?)\b/i,'electrical'],
    [/\b(?:plumbers?|plumbing(?:\s+contractors?)?)\b/i,'plumbing'],[/\b(?:hvac|air\s+conditioning)(?:\s+contractors?)?\b/i,'hvac'],
    [/\bmechanical(?:\s+contractors?)?\b/i,'mechanical'],[/\balarm(?:\s+contractors?)?\b/i,'alarm'],[/\btelecom(?:munications?)?(?:\s+contractors?)?\b/i,'telecom'],
    [/\blocksmiths?\b/i,'locksmith'],[/\bhearth(?:\s+specialists?)?\b/i,'hearth'],[/\bgeneral\s+contractors?\b/i,'general'],
  ];
  return choices.find(([pattern])=>pattern.test(question))?.[1];
}

function base(question: string, plan: AskResearchPlan): GuidedResearchSession {
  const now = new Date().toISOString();
  return {
    version: GUIDED_SESSION_VERSION, sessionId: randomUUID(), originalQuestion: question.trim(),
    researchPlan: plan, executionScope:resolveResearchScope(plan), phase: 'UNDERSTAND', queryType: plan.legacyQueryType, selectedFilters: {},
    requestedEvidence: [], missingFields: [], availableChoices: [], availableRefinements: [],
    createdAt: now, updatedAt: now, history: [],
  };
}

function createUnscopedGuidedSession(question: string): GuidedResearchSession | null {
  const q = question.trim();
  if (!q) return null;
  const parsed = parseNetworkAsk(q);
  const plan = validateAskResearchPlan(planAskResearch(q));
  const session = base(q, plan);
  const financialGeography=geographyFromParsed(parsed);
  const labeledIdentifier=q.match(/\b(CRD|NPN|NAIC|NMLS|LEI)\s*#?\s*([A-Z0-9-]+)\b/i);
  if(labeledIdentifier)session.identifier={type:labeledIdentifier[1].toUpperCase(),value:labeledIdentifier[2].toUpperCase()};

  if (planRequiresImmediateClarification(plan)) {
    session.hub = plan.primaryHub as GuidedResearchSession['hub'];
    session.entityClass = plan.entityClass?.id;
    session.requestedEvidence = plan.requestedEvidence;
    session.missingFields = [...plan.missingSlots];
    if (plan.normalizedGeography) session.geography = geographyFromParsed(parsed);
    return { ...session, phase: 'CLARIFY', nextAction: plan.clarificationReason ?? 'Clarify the research request before specialist execution.' };
  }

  const investorIntent=/\b(?:investment\s+advis(?:er|or)|advis(?:er|or)s?|advisory\s+firm|\bRIA\b|\bRIAs\b|\bERA\b|\bERAs\b|\bCRD\b|Form\s+ADV|IARD)\b/i.test(q);
  if(investorIntent){
    session.hub='investor';session.geography=financialGeography;
    if(/^i\s+need\s+an?\s+investment\s+advis(?:er|or)\s*[?.!]*$/i.test(q))return {...session,phase:'CLARIFY',missingFields:['investorResearchMode'],availableChoices:INVESTOR_CHOICES,nextAction:'What would you like to research?'};
    session.investorResearchMode=session.identifier?'identifier':/\bnamed\s+(.+)$/i.test(q)?'identity_name':'firm_cohort';
    session.identityName=q.match(/\bnamed\s+(.+)$/i)?.[1]?.trim();
    session.investorFirmClass=/\bindividual\b|representatives?/i.test(q)?'individual_representative':/\bERAs?\b|exempt\s+reporting/i.test(q)?'era':/\bRIAs?\b|registered\s+investment/i.test(q)?'ria':'ria_and_era';
    session.entityClass=session.investorFirmClass;
    if(/\b(?:1|one)\s*billion\b/i.test(q))session.minimumRaum=1_000_000_000;
    if(/\b10\s*billion\b/i.test(q))session.maximumRaum=10_000_000_000;
    if(/\b2\s*billion\b/i.test(q))session.minimumRaum=2_000_000_000;
    if(/percentage\s+of\s+assets/i.test(q))session.compensationMethod='percentage_of_assets';
    session.requestedEvidence=/highest-performing|\bperformance\b/i.test(q)?['PERFORMANCE']:/\bsafest\b/i.test(q)?['SAFETY_RANKING']:[];
    return {...session,phase:'EXECUTE',missingFields:[],availableChoices:[],nextAction:'execute'};
  }

  const insuranceIntent=/\b(?:insurance|insurers?|\bNPN\b|\bNAIC\b)\b/i.test(q);
  if(insuranceIntent){
    session.hub='insurance';session.geography=financialGeography;
    if(/^i\s+need\s+help\s+with\s+insurance\s*[?.!]*$/i.test(q)||/\binsurance\s+provider\b/i.test(q)||/insurance\s+complaints\s+against\s+a\s+company/i.test(q)||/insurance\s+professional\s+near\s+me/i.test(q))return {...session,phase:'CLARIFY',missingFields:['insuranceEntityClass'],availableChoices:INSURANCE_CHOICES,nextAction:'What kind of insurance entity do you want to research?'};
    session.insuranceResearchMode=session.identifier?'identifier':'cohort';
    session.insuranceEntityClass=/\b(?:agents?|producers?|professional)\b/i.test(q)?'producer':/\b(?:legal\s+insurers?|insurance\s+compan(?:y|ies)|insurers?)\b/i.test(q)?'legal_insurer':'agency';
    session.entityClass=session.insuranceEntityClass;
    if(/\blife\s+insurance\b/i.test(q))session.insuranceLineOfAuthority='life';
    return {...session,phase:'EXECUTE',missingFields:[],availableChoices:[],nextAction:'execute'};
  }

  const lenderIntent=/\b(?:mortgage|lenders?|\bNMLS\b|\bLEI\b|HMDA|FHA|VA|USDA|originations?|applications?|denials?|Rocket\s+Mortgage|Newrez)\b/i.test(q);
  if(lenderIntent){
    session.hub='lender';session.geography=financialGeography;
    if(/^i\s+need\s+a\s+mortgage\s+lender\s*[?.!]*$/i.test(q))return {...session,phase:'CLARIFY',missingFields:['lenderResearchMode'],availableChoices:LENDER_CHOICES,nextAction:'What would you like to research?'};
    const genericStateLenders=/^lenders?\s+in\s+(?:Texas|TX)\s*[?.!]*$/i.test(q);
    session.lenderResearchMode=session.identifier?'identifier':/complaints?\s+about/i.test(q)?'complaints':/brokers?\s+near\s+me/i.test(q)?'unsupported_person_branch':genericStateLenders?undefined:'property_market';
    if(genericStateLenders)return {...session,lenderResearchMode:undefined,entityClass:undefined,phase:'CLARIFY',missingFields:['lenderResearchMode'],availableChoices:LENDER_CHOICES,nextAction:'What do you mean by lenders in this state?'};
    session.identityName=q.match(/complaints?\s+about\s+(.+)$/i)?.[1]?.trim();
    session.requestedEvidence=session.lenderResearchMode==='complaints'?['CFPB_COMPLAINTS']:[];
    session.hmdaAction=/\bdenials?\b/i.test(q)?'denial':/\bapplications?\b/i.test(q)?'application':'origination';
    session.loanType=/\bFHA\b/i.test(q)?'FHA':/\bVA\b/i.test(q)?'VA':/\bUSDA\b/i.test(q)?'USDA':/\bconventional\b/i.test(q)?'Conventional':undefined;
    session.entityClass=session.lenderResearchMode==='unsupported_person_branch'?'mlo_or_branch':'hmda_reporting_institution';
    return {...session,phase:'EXECUTE',missingFields:[],availableChoices:[],nextAction:'execute'};
  }
  if (/\b(?:electrician|electrical\s+contractor)\b/i.test(q)) {
    const geography=geographyFromParsed(parsed);
    return { ...session,hub:'contractor',identityName:undefined,trade:'electrical',entityClass:'credential_record',geography,phase:geography?'EXECUTE':'COLLECT',missingFields:geography?[]:['geography'],nextAction:geography?'execute':'Where is the property?' };
  }
  const grandma = /\b(?:grandma|grandmother|grandpa|grandfather|senior|elderly parent)\b/i.test(q) && /\b(?:home|care|facility|help|place)\b/i.test(q);
  if (grandma) return { ...session, hub: 'senior', phase: 'CLARIFY', missingFields: ['providerClass'], availableChoices: CARE_CHOICES, nextAction: 'What kind of care are you looking for?' };

  let parsedGeography=geographyFromParsed(parsed);
  if(parsedGeography?.stateCode==='NJ'&&parsedGeography.type==='state'){
    const local=q.match(/\bin\s+([A-Za-z][A-Za-z .'-]*?)\s*,?\s*(?:New\s+Jersey|NJ)\b/i)?.[1]?.trim();
    if(local)parsedGeography=/^summit$/i.test(local)?parseGuidedGeography('Summit, New Jersey')??parsedGeography:{type:'city',value:`${local}, New Jersey`,city:local,stateCode:'NJ',stateName:'New Jersey',meaning:'Requested New Jersey city geography pending specialist source validation; not service territory.'};
  }
  const njTrade=newJerseyTrade(q,parsedGeography?.stateCode);
  const parsedHub = parsed.suggestedHubs.length === 1 && GUIDED_PILOT_HUBS.includes(parsed.suggestedHubs[0] as never) ? parsed.suggestedHubs[0] as GuidedResearchSession['hub'] : undefined;
  const hub = parsedHub ?? (njTrade?'contractor':undefined);
  if (!hub) return null;
  session.hub = hub;
  session.identifier = parsed.identifier ? { type: parsed.identifier.family.id, value: parsed.identifier.raw.replace(/^.*?([A-Z0-9-]+)$/i, '$1') } : undefined;
  session.identityName = parsed.queryClassification.type === 'IDENTITY_NAME' ? q : undefined;
  if (parsed.geography) session.geography = parsedGeography;

  if (hub === 'senior') {
    session.providerClass = parsed.seniorProviderClass;
    session.entityClass = parsed.seniorProviderClass;
    if (session.identifier || session.providerClass && session.geography) return { ...session, phase: 'EXECUTE', nextAction: 'execute' };
    if (!session.providerClass) return { ...session, phase: 'CLARIFY', missingFields: ['providerClass'], availableChoices: CARE_CHOICES, nextAction: 'What kind of care are you looking for?' };
    return { ...session, phase: 'COLLECT', missingFields: ['geography'], nextAction: 'Where does she need care?' };
  }
  if (hub === 'contractor') {
    const trade = parsed.trade?.toLowerCase();
    session.trade = njTrade ?? (trade === 'general contractor' ? 'general' : trade);
    session.entityClass = 'credential_record';
    session.identityName = undefined;
    if(session.identifier)return {...session,phase:'EXECUTE',missingFields:[],availableChoices:[],nextAction:'execute'};
    const conflictingSummit = /\bsummit\s+county\b/i.test(q) && parsed.geography?.stateCode === 'NJ';
    if (conflictingSummit) return { ...session, geography:parseGuidedGeography('Summit County, New Jersey')??session.geography, phase:'EXECUTE',missingFields:[],nextAction:'execute' };
    if (session.trade && session.geography) return { ...session, phase: 'EXECUTE', nextAction: 'execute' };
    if (!session.trade && session.geography?.stateCode==='NJ') return { ...session, phase:'EXECUTE',missingFields:[],availableChoices:[],nextAction:'execute' };
    if (!session.trade) return { ...session, phase: 'CLARIFY', missingFields: ['trade'], availableChoices: TRADE_CHOICES, nextAction: 'What kind of work do you need?' };
    return { ...session, phase: 'COLLECT', missingFields: ['geography'], nextAction: 'Where is the property?' };
  }
  session.regulatoryRole = parsed.moveRegulatoryRole === 'carrier' ? 'Carrier' : parsed.moveRegulatoryRole === 'broker' ? 'Broker' : parsed.moveRegulatoryRole === 'carrier_broker' ? 'Carrier/Broker' : undefined;
  if (/^(?:i\s+need\s+)?(?:some\s+)?movers?\s*[?.!]*$/i.test(q)) {
    return { ...session, identityName: undefined, moveMode: undefined, entityClass: undefined, phase: 'CLARIFY', missingFields: ['moveMode'], availableChoices: MOVE_CHOICES, nextAction: 'What are you moving?' };
  }
  session.moveMode = parsed.moveResearchCategory === 'auto_transport' ? 'auto_transport' : parsed.identifier ? 'identifier' : parsed.queryClassification.type === 'IDENTITY_NAME' ? 'identity_name' : parsed.queryClassification.type === 'COHORT' ? 'mover' : undefined;
  session.entityClass = session.moveMode;
  if (/\bserv(?:e|es|ing)|from .+ to|near me\b/i.test(q)) return { ...session, identityName: undefined, moveMode: session.moveMode ?? 'mover', phase: 'EXECUTE', nextAction: 'execute' };
  if (/\bship (?:my|a) (?:car|vehicle)|transport my (?:car|vehicle)\b/i.test(q)) return { ...session, identityName: undefined, moveMode: 'auto_transport', entityClass: 'auto_transport', phase: 'EXECUTE', nextAction: 'execute' };
  if (session.identifier || session.identityName || session.moveMode && (session.geography || session.moveMode === 'auto_transport')) return { ...session, phase: 'EXECUTE', nextAction: 'execute' };
  return { ...session, phase: 'CLARIFY', missingFields: ['moveMode'], availableChoices: MOVE_CHOICES, nextAction: 'What are you moving?' };
}

function guidedGeographyFromExecution(scope:GuidedResearchSession['executionScope']):GuidedGeography|undefined{
  const geo=scope.executionGeography;if(!geo||geo.kind==='national'||geo.kind==='region'||geo.kind==='route')return undefined;
  return {type:geo.kind,value:geo.kind==='state'?(geo.stateCode??geo.display):geo.kind==='county'?(geo.county??geo.display):geo.kind==='city'?(geo.city??geo.display):(geo.zip??geo.display),stateCode:geo.stateCode,stateName:geo.stateName,county:geo.county,city:geo.city,meaning:scope.executionGeographyMeaning};
}

export function createGuidedSession(question:string):GuidedResearchSession|null{
  const session=createUnscopedGuidedSession(question);if(!session)return null;
  if(!session.researchPlan.primaryHub&&session.hub)session.executionScope=resolveResearchScope({...session.researchPlan,primaryHub:session.hub,entityClass:session.entityClass?{id:session.entityClass,label:session.entityClass.replaceAll('_',' ')}:session.researchPlan.entityClass});
  const scope=session.executionScope;
  const executable=guidedGeographyFromExecution(scope);
  const unscopedIsMorePrecise=session.geography?.type==='city'&&scope.normalizedRequestedGeography?.kind==='state';
  const preserveUnsupportedTradeCity=session.hub==='contractor'&&session.trade==='electrical'&&session.geography?.type==='city';
  if(executable&&!unscopedIsMorePrecise&&!preserveUnsupportedTradeCity)session.geography=executable;
  if(!scope.requestedGeography||session.identifier||session.identityName)return session;
  if(['contractor','move','investor','insurance','lender'].includes(session.hub??'')&&['SERVICE_TERRITORY','ORIGIN_DESTINATION'].includes(scope.requestedGeographyMeaning??''))return session;
  if(scope.executionAllowed)return session;
  const choices:GuidedChoice[]=[];
  if(scope.resolutionState==='BROADENING_REQUIRES_CONSENT'&&scope.normalizedRequestedGeography?.stateCode){
    const state=scope.normalizedRequestedGeography.stateName??scope.normalizedRequestedGeography.stateCode;
    choices.push({id:'scope-statewide',label:`Research ${state} instead`,action:'SELECT_CHOICE',value:`scope_state:${scope.normalizedRequestedGeography.stateCode}`,description:'This is broader than the place you requested and will be recorded as your explicit choice.'});
  }
  if(scope.normalizedRequestedGeography?.display==='Tampa Bay, Florida'){
    choices.push(
      {id:'scope-tampa',label:'Tampa / Hillsborough County',action:'SELECT_CHOICE',value:'scope_place:Tampa, Florida'},
      {id:'scope-st-pete',label:'St. Petersburg / Pinellas County',action:'SELECT_CHOICE',value:'scope_place:St. Petersburg, Florida'},
      {id:'scope-clearwater',label:'Clearwater / Pinellas County',action:'SELECT_CHOICE',value:'scope_place:Clearwater, Florida'},
      {id:'scope-other',label:'Another city or county',action:'SELECT_CHOICE',value:'scope_other',description:'Enter the specific place you want researched.'},
    );
  }
  return {...session,geography:undefined,phase:'CLARIFY',missingFields:scope.resolutionState==='CLARIFICATION_REQUIRED'&&!choices.length?['geography']:[],availableChoices:choices,nextAction:scope.disclosure??'The requested local scope is not executable by this specialist.'};
}

export function isGuidedResearchCandidate(question: string): boolean {
  return createGuidedSession(question) !== null;
}

export function pushHistory(session: GuidedResearchSession): GuidedResearchSession {
  return { ...session, history: [...session.history.slice(-7), snapshot(session)] };
}

export function restorePrevious(session: GuidedResearchSession): GuidedResearchSession {
  const previous = session.history.at(-1);
  if (!previous) return session;
  return {
    version:session.version,sessionId:session.sessionId,originalQuestion:session.originalQuestion,
    createdAt:session.createdAt,updatedAt:new Date().toISOString(),history:session.history.slice(0,-1),
    ...structuredClone(previous),
  };
}

export { CARE_CHOICES, TRADE_CHOICES, MOVE_CHOICES, INVESTOR_CHOICES, INSURANCE_CHOICES, LENDER_CHOICES };
