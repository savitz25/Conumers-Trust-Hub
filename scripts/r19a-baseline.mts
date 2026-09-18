// TH-SEARCH-R1-019A baseline reproduction: what the planner/session/decision do with name inputs.
import { buildAskResearchRoute } from '../lib/network/ask-research-route.ts';
import { decideAskExecution } from '../lib/network/execution-decision.ts';
import { createGuidedSession } from '../lib/guided-research/session.ts';

const inputs = [
  'Allied', 'allied', 'Cirta', '1-800-Pack-Rat', '10 East Partners', 'Allied Moving',
  'Pure Moving Company', 'A Holly Patterson Extended Care Facility', 'Allied Van Lines',
  'Abbey Delray South', 'Tate Asset Management', 'Rocket Mortgage',
  'roofers in Broward County', 'Who owns this company?', 'NMLS 401052', 'USDOT 3244649',
];
const out = inputs.map((q) => {
  const route = buildAskResearchRoute(q);
  const decision = decideAskExecution(q, route.plan);
  const s = createGuidedSession(q);
  return {
    q, primaryHub: route.plan.primaryHub ?? null, reasonCodes: route.plan.reasonCodes,
    canExecute: route.canExecute, decisionMode: decision.mode, executionAllowed: decision.executionAllowed,
    guidedHub: s?.hub ?? null, identityName: s?.identityName ?? null, identifier: s?.identifier ?? null,
    missing: s?.missingFields ?? null, journey: Boolean(route.journey),
  };
});
console.log(JSON.stringify(out, null, 1));
