import { sqlName, type DeploymentTarget } from './isolated-config.ts';

/**
 * SENIOR ACCOUNT-CONTEXT SEAM. The only place Senior touches account-context
 * issuance.
 *
 * A Save commit consumes the one-time account context as the hub of the
 * verified caller. prod_issue_context() always issues as hub 'move', so a
 * Senior commit can never consume it. Senior therefore must NOT use the Move
 * issuer. It calls the standard shared per-hub issuer that G-B2 owns
 * (packet 15, v23_private.prod_hub_issue_context(proof, subject, session, hub))
 * with the hub fixed here on the server.
 *
 * WAITING ON G-B2: packet 15 as prepared admits 'lender' and 'insurance' only.
 * Until it also maps
 *     'senior' -> 'https://www.seniortrusthub.com'
 * this call is refused by the database ('hub', 42501) or the function does not
 * exist. Either way the Save fails closed: no context, no Saved row, no
 * acknowledgement. Nothing in this file creates a Senior issuer, copies the
 * Investor issuer, widens consume_context, or reads the hub from a request.
 */
export const SENIOR_CONTEXT_HUB = 'senior' as const;

/** True only for a caller verified as Senior from its signed assertion. */
export function isSeniorContextCaller(hub: string): hub is typeof SENIOR_CONTEXT_HUB {
  return hub === SENIOR_CONTEXT_HUB;
}

/** The shared per-hub issuer, four arguments, hub last. */
export function seniorAccountContextSql(target: DeploymentTarget): string {
  return `select ${sqlName(target, 'hub_issue_context')}($1,$2,$3,$4) as issued`;
}

/** Parameters for seniorAccountContextSql. The hub is the constant, never input. */
export function seniorAccountContextValues(proof: unknown, subject: string, session: string): [string, string, string, typeof SENIOR_CONTEXT_HUB] {
  return [JSON.stringify(proof), subject, session, SENIOR_CONTEXT_HUB];
}
