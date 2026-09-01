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
  ['roofing', 'Roofing'], ['hvac', 'HVAC'], ['plumbing', 'Plumbing'], ['general', 'General/building construction'], ['pool_spa', 'Pool/spa'], ['mechanical', 'Mechanical'],
].map(([value, label]) => ({ id: `trade-${value}`, label, action: 'SELECT_CHOICE' as const, value }));
const MOVE_CHOICES: GuidedChoice[] = [
  { id: 'move-household', label: 'Household belongings', action: 'SELECT_CHOICE', value: 'mover' },
  { id: 'move-auto', label: 'A car or vehicle', action: 'SELECT_CHOICE', value: 'auto_transport' },
  { id: 'move-company', label: 'I have a specific company to research', action: 'SELECT_CHOICE', value: 'identity_name' },
  { id: 'move-id', label: 'I have a USDOT or MC number', action: 'SELECT_CHOICE', value: 'identifier' },
];

function snapshot(session: GuidedResearchSession): GuidedSessionSnapshot {
  return {
    phase: session.phase, hub: session.hub, entityClass: session.entityClass,
    providerClass: session.providerClass, trade: session.trade, moveMode: session.moveMode,
    regulatoryRole: session.regulatoryRole, geography: session.geography,
    selectedFilters: { ...session.selectedFilters },
  };
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
  if (/^\d{5}$/.test(value)) return { type: 'zip', value, meaning: 'Recorded ZIP in the specialist source; not service availability.' };
  const parsed = parseNetworkAsk(`providers in ${value}`);
  if (parsed.geography?.countyName) return { type: 'county', value: parsed.geography.countyName.replace(/ County$/i, ''), county: parsed.geography.countyName.replace(/ County$/i, ''), stateCode: parsed.geography.stateCode, stateName: parsed.geography.stateName, meaning: 'Recorded county geography; not service territory.' };
  if (parsed.geography?.city) return { type: 'city', value: parsed.geography.city, city: parsed.geography.city, stateCode: parsed.geography.stateCode, stateName: parsed.geography.stateName, meaning: 'Recorded city/address geography; not service territory.' };
  if (parsed.geography?.stateCode) return { type: 'state', value: parsed.geography.stateCode, stateCode: parsed.geography.stateCode, stateName: parsed.geography.stateName, meaning: 'Recorded state geography; not service territory.' };
  if (/broward/i.test(value)) return { type: 'county', value: 'Broward', county: 'Broward', stateCode: 'FL', stateName: 'Florida', meaning: 'Recorded Broward County geography; not service territory.' };
  if (/palm\s*beach/i.test(value)) return { type: 'county', value: 'Palm Beach', county: 'Palm Beach', stateCode: 'FL', stateName: 'Florida', meaning: 'Recorded Palm Beach County geography; not service territory.' };
  return { type: 'city', value, city: value, meaning: 'Recorded city/address geography where supported; not service territory.' };
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
  const grandma = /\b(?:grandma|grandmother|grandpa|grandfather|senior|elderly parent)\b/i.test(q) && /\b(?:home|care|facility|help|place)\b/i.test(q);
  if (grandma) return { ...session, hub: 'senior', phase: 'CLARIFY', missingFields: ['providerClass'], availableChoices: CARE_CHOICES, nextAction: 'What kind of care are you looking for?' };

  const hub = parsed.suggestedHubs.length === 1 && GUIDED_PILOT_HUBS.includes(parsed.suggestedHubs[0] as never) ? parsed.suggestedHubs[0] as GuidedResearchSession['hub'] : undefined;
  if (!hub) return null;
  session.hub = hub;
  session.identifier = parsed.identifier ? { type: parsed.identifier.family.id, value: parsed.identifier.raw.replace(/^.*?([A-Z0-9-]+)$/i, '$1') } : undefined;
  session.identityName = parsed.queryClassification.type === 'IDENTITY_NAME' ? q : undefined;
  if (parsed.geography) session.geography = parseGuidedGeography(parsed.geography.countyName ?? parsed.geography.city ?? parsed.geography.stateName ?? '') ?? undefined;

  if (hub === 'senior') {
    session.providerClass = parsed.seniorProviderClass;
    session.entityClass = parsed.seniorProviderClass;
    if (session.identifier || session.providerClass && session.geography) return { ...session, phase: 'EXECUTE', nextAction: 'execute' };
    if (!session.providerClass) return { ...session, phase: 'CLARIFY', missingFields: ['providerClass'], availableChoices: CARE_CHOICES, nextAction: 'What kind of care are you looking for?' };
    return { ...session, phase: 'COLLECT', missingFields: ['geography'], nextAction: 'Where is care needed?' };
  }
  if (hub === 'contractor') {
    const trade = parsed.trade?.toLowerCase();
    session.trade = trade === 'general contractor' ? 'general' : trade;
    session.entityClass = 'credential_record';
    if (session.trade && session.geography) return { ...session, phase: 'EXECUTE', nextAction: 'execute' };
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
  return { ...session, ...previous, history: session.history.slice(0, -1), availableRefinements: [], resultCount: undefined, updatedAt: new Date().toISOString() };
}

export { CARE_CHOICES, TRADE_CHOICES, MOVE_CHOICES };
