import { sqlName, type DeploymentTarget } from './isolated-config.ts';

/** Hub string GB2's per-hub account-context issuer must later admit.
 * Packet 15 (`prod_hub_issue_context`) currently allows lender and insurance
 * only. Contractor is not in that allowlist. This file is the only
 * incorporation point. Do not call hub_issue_context from this branch. */
export const CONTRACTOR_CONTEXT_HUB = 'contractor' as const;

/** Shared three-argument issuer. Move, Lender, Insurance, and Contractor all
 * still use it. Replacing this string is how the GB2 contract is incorporated
 * after `contractor` is added to the hub allowlist. */
export function issueSharedAccountContext(target: DeploymentTarget): string {
  return `select ${sqlName(target, 'issue_context')}($1,$2,$3) as issued`;
}
