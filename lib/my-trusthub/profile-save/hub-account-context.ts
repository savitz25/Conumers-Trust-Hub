import { sqlName, type DeploymentTarget } from './isolated-config.ts';
import { RuntimeError } from './runtime.ts';

/** Standard specialist hubs admitted by the shared issuer (`prod_hub_issue_context`).
 * Packet 15 creates the function for lender, insurance, and contractor.
 * Packet 18 adds senior. The origin stays pinned inside that function.
 * Move stays on `issue_context`. Investor stays on `investor_issue_context`.
 * The hub is the verified caller hub. It is never read from the browser or the proof. */
export const SHARED_HUB_ACCOUNT_CONTEXT = ['lender', 'insurance', 'contractor', 'senior'] as const;
export type SharedHubAccountContext = typeof SHARED_HUB_ACCOUNT_CONTEXT[number];

export function isSharedHubAccountContext(hub: string): hub is SharedHubAccountContext {
  return (SHARED_HUB_ACCOUNT_CONTEXT as readonly string[]).includes(hub);
}

/** One issuer call. `hubArgument` is the verified hub passed as $4.
 * A dedicated issuer takes only the proof, subject, and session. */
export function accountContextIssueQuery(target: DeploymentTarget, hub: string): { text: string; hubArgument: boolean } {
  if (hub === 'move') return { text: `select ${sqlName(target, 'issue_context')}($1,$2,$3) as issued`, hubArgument: false };
  if (hub === 'investor') return { text: `select ${sqlName(target, 'investor_issue_context')}($1,$2,$3) as issued`, hubArgument: false };
  if (!isSharedHubAccountContext(hub)) throw new RuntimeError('unavailable');
  return { text: `select ${sqlName(target, 'hub_issue_context')}($1,$2,$3,$4) as issued`, hubArgument: true };
}
