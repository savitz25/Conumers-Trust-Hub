import { sqlName, type DeploymentTarget } from './isolated-config.ts';
import { RuntimeError } from './runtime.ts';

/** Verified caller hub for a Contractor Save. Packet 15 owns the SQL. */
export const CONTRACTOR_CONTEXT_HUB = 'contractor' as const;

/** Proof built by the server. These names are refused if a browser field is copied in. */
export type AccountContextProof = {
  code: string;
  state: string;
  nonce: string;
  intent: string;
  creationKey: string;
  targetOrigin: string;
  rateBucket: string;
};

const SHARED_HUBS = ['lender', 'insurance', 'contractor'] as const;
const BROWSER_CONTEXT_KEYS = ['hub', 'sourceHub', 'issuer', 'issuerHub', 'origin'] as const;

/**
 * One issuer call for the hub the server already verified.
 * Move keeps issue_context. Investor keeps investor_issue_context.
 * Lender, Insurance, and Contractor use packet 15 hub_issue_context.
 * Any other hub fails closed. This file does not create a SQL function.
 */
export function accountContextIssueQuery(target: DeploymentTarget, hub: string): { text: string; hubArgument: boolean } {
  if (hub === 'move') return { text: `select ${sqlName(target, 'issue_context')}($1,$2,$3) as issued`, hubArgument: false };
  if (hub === 'investor') return { text: `select ${sqlName(target, 'investor_issue_context')}($1,$2,$3) as issued`, hubArgument: false };
  if (!(SHARED_HUBS as readonly string[]).includes(hub)) throw new RuntimeError('unavailable');
  return { text: `select ${sqlName(target, 'hub_issue_context')}($1,$2,$3,$4) as issued`, hubArgument: true };
}

/** Bind the statement to the verified hub. The hub is never taken from the proof. */
export function accountContextIssueCall(target: DeploymentTarget, verifiedHub: string, proof: AccountContextProof, subject: string, session: string): { text: string; values: unknown[] } {
  const record = proof as AccountContextProof & Record<string, unknown>;
  if (BROWSER_CONTEXT_KEYS.some(key => Object.hasOwn(record, key))) throw new RuntimeError('unavailable');
  const issue = accountContextIssueQuery(target, verifiedHub);
  const values = [JSON.stringify(proof), subject, session];
  if (issue.hubArgument) values.push(verifiedHub);
  return { text: issue.text, values };
}
