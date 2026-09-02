import { randomUUID } from 'node:crypto';
import { parseNetworkAsk } from '../network/ask-parse.ts';
import { GUIDED_PHASES, GUIDED_PILOT_HUBS, GUIDED_SESSION_TTL_MS, GUIDED_SESSION_VERSION, type GuidedChoice, type GuidedGeography, type GuidedResearchSession, type GuidedSessionSnapshot } from './contract.ts';

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

function snapshot(session: GuidedResearchSession): GuidedSessionSnapshot {
  const state = structuredClone(session) as GuidedResearchSession & Record<string, unknown>;
  for (const key of ['version','sessionId','originalQuestion','createdAt','updatedAt','history']) delete state[key];
  return state;
}

export function validateGuidedSession(value: unknown): GuidedResearchSession | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as GuidedResearchSession;
  if (row.version !== GUIDED_SESSION_VERSION || !row.sessionId || !row.originalQuestion) return null;
  if (!GUIDED_PHASES.includes(row.phase) || (row.hub && !GUIDED_PILOT_HUBS.includes(row.hub))) return null;
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

function base(question: string): GuidedResearchSession {
  const parsed = parseNetworkAsk(question);
  const now = new Date().toISOString();
  return {
    version: GUIDED_SESSION_VERSION, sessionId: randomUUID(), originalQuestion: question.trim(),
    phase: 'UNDERSTAND', queryType: parsed.queryClassification.type, selectedFilters: {},
    requestedEvidence: [], missingFields: [], availableChoices: [], availableRefinements: [],
    createdAt: now, updatedAt: now, history: [],
  };
}

export function createGuidedSession(question: string): GuidedResearchSession | null {
  const q = question.trim();
  if (!q) return null;
  const parsed = parseNetworkAsk(q);
  const session = base(q);
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
    if (conflictingSummit) return { ...session, phase:'EXECUTE',missingFields:[],nextAction:'execute' };
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

export { CARE_CHOICES, TRADE_CHOICES, MOVE_CHOICES };
