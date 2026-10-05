import { accountContextIssueQuery } from './hub-account-context.ts';
import { RuntimeError } from './runtime.ts';
import type { DeploymentTarget } from './isolated-config.ts';

export { accountContextIssueQuery };

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

const BROWSER_CONTEXT_KEYS = ['hub', 'sourceHub', 'issuer', 'issuerHub', 'origin'] as const;

/** Bind the statement to the verified hub. The hub is never taken from the proof. */
export function accountContextIssueCall(target: DeploymentTarget, verifiedHub: string, proof: AccountContextProof, subject: string, session: string): { text: string; values: unknown[] } {
  const record = proof as AccountContextProof & Record<string, unknown>;
  if (BROWSER_CONTEXT_KEYS.some(key => Object.hasOwn(record, key))) throw new RuntimeError('unavailable');
  const issue = accountContextIssueQuery(target, verifiedHub);
  const values = [JSON.stringify(proof), subject, session];
  if (issue.hubArgument) values.push(verifiedHub);
  return { text: issue.text, values };
}
