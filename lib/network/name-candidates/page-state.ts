/**
 * TH-SEARCH-R1-019A: the ONE place that decides what the Ask page shows for a name.
 *
 * Once NAME_CANDIDATES is the effective operation its name, coverage and result state are carried
 * through rendering -- whatever the outcome. A timeout, an unavailable or unsupported source, an
 * incomplete page or a genuine miss NEVER silently reclassifies the customer's name as a category
 * question, and never dispatches a second (cohort) retrieval. The category reading is reachable
 * only through the explicit, labeled alternate action (interpret=category).
 */
import type { AskResearchPlan } from '../research-planner.ts';
import type { NameCandidateResponse } from './contract.ts';
import { decideNameCandidateSearch, type NameCandidateDecision } from './decision.ts';
import { searchNameCandidates, type OrchestratorOptions } from './orchestrator.ts';
import { askCategoryHref, type AlternateAction } from './view.ts';

export type AskNameState =
  | { mode: 'NAME_RESULTS'; decision: Extract<NameCandidateDecision, { operation: 'NAME_CANDIDATES' }>; response: NameCandidateResponse; alternate: AlternateAction | null }
  | { mode: 'LEGACY'; reason: string };

export function alternateActionFor(decision: Extract<NameCandidateDecision, { operation: 'NAME_CANDIDATES' }>): AlternateAction | null {
  if (!decision.alternateCohortInterpretation) return null;
  return { label: `Not looking for a business named “${decision.name}”? Research these words as a category instead`, href: askCategoryHref(decision.originalInput) };
}

export async function resolveAskNameState(input: { query: string; plan: AskResearchPlan; selectedHub?: string | null; interpretAs?: string | null }, options: OrchestratorOptions = {}): Promise<AskNameState> {
  const decision = decideNameCandidateSearch(input.query, { plan: input.plan, selectedHub: input.selectedHub ?? null, interpretAs: input.interpretAs ?? null });
  if (decision.operation !== 'NAME_CANDIDATES') return { mode: 'LEGACY', reason: decision.reason };
  const response = await searchNameCandidates({ originalInput: decision.originalInput, name: decision.name, hubScope: decision.hubScope, priorityHubs: decision.priorityHubs, unresolvedConditions: decision.unresolvedConditions }, options);
  return { mode: 'NAME_RESULTS', decision, response, alternate: alternateActionFor(decision) };
}
