import {
  AUTHORITY_EVIDENCE,
  type AuthorityEvidenceCode,
} from "../customer/claim-governance.ts";
import type { RelationshipType } from "../customer/types.ts";
import {
  validateClaimPolicyV1,
  type ClaimPolicyV1,
} from "./contracts/claim-policy-v1.ts";

export type PolicyCellStatus = "PROVEN" | "PARTIAL" | "NOT_YET_DEFINED";
export type ClaimPolicyCell = ClaimPolicyV1 & {
  status: PolicyCellStatus;
  production_enabled: true;
};
const common = {
  schema_version: "claim_policy.v1",
  policy_version: "ath-claim-policy-2026-09-09.1",
  jurisdiction: "*",
  strong_verification_signals: [
    "CORPORATE_OFFICER_MATCH",
    "REGULATOR_QUALIFIER_MATCH",
    "VERIFIED_PUBLIC_CALLBACK",
    "VERIFIED_OFFICER_AUTHORIZATION",
    "EXISTING_VERIFIED_ORG_AUTHORITY",
  ],
  step_up_signals: [
    "FREE_EMAIL_ACCOUNT",
    "COMPANY_DOMAIN_CONTROL",
    "THIRD_PARTY_AGENCY",
  ],
  disqualifiers: [
    "IDENTITY_MISMATCH",
    "CONTRADICTORY_CALLBACK",
    "BYPASS_REQUEST",
  ],
  conflicting_signals: ["FORMER_EMPLOYEE_OR_OFFICER", "THIRD_PARTY_AGENCY"],
  competing_claim: "HOLD",
  existing_management_grant: "HOLD",
  third_party_representative: "HOLD",
  risk_signals: [
    "HIGH_CLAIM_VELOCITY",
    "REPEATED_IDENTITY_MISMATCH",
    "PRIOR_REVOKED_GRANT",
    "HANDOFF_PROFILE_SUBSTITUTION",
  ],
  automatic_approval_eligibility: "INELIGIBLE",
  required_evidence: [
    "EXACT_PROFILE_REVALIDATED",
    "INDEPENDENT_AUTHORITY_SIGNAL",
    "CONTROL_OR_CONTACT_SIGNAL",
  ],
  default_result: "AMBER",
  status: "PARTIAL",
  production_enabled: true,
} as const;
function cell(
  hub: ClaimPolicyV1["hub"],
  profile_class: string,
): ClaimPolicyCell {
  return {
    ...common,
    hub,
    profile_class,
    strong_verification_signals: [...common.strong_verification_signals],
    step_up_signals: [...common.step_up_signals],
    disqualifiers: [...common.disqualifiers],
    conflicting_signals: [...common.conflicting_signals],
    risk_signals: [...common.risk_signals],
    required_evidence: [...common.required_evidence],
  };
}
export const CLAIM_POLICY_REGISTRY: readonly ClaimPolicyCell[] = [
  cell("contractor", "contractor"),
  cell("move", "mover"),
  cell("lender", "institution"),
  cell("insurance", "legal_insurer"),
  cell("investor", "firm"),
  cell("senior", "nursing_home"),
  cell("senior", "home_health"),
  cell("senior", "hospice"),
];
for (const policy of CLAIM_POLICY_REGISTRY) {
  const v = validateClaimPolicyV1(policy);
  if (!v.ok) throw new Error(`invalid_claim_policy:${v.errors.join(",")}`);
}
export function claimPolicy(
  hub: string,
  profileClass: string,
  jurisdiction: string,
): ClaimPolicyCell | null {
  return (
    CLAIM_POLICY_REGISTRY.find(
      (p) =>
        p.hub === hub &&
        p.profile_class === profileClass &&
        (p.jurisdiction === "*" || p.jurisdiction === jurisdiction),
    ) ?? null
  );
}
export type PolicyEvaluation = {
  result: "GREEN" | "AMBER" | "RED" | "NOT_YET_DEFINED";
  policyVersion: string;
  strongSignals: string[];
  missingEvidence: string[];
  stepUpReasons: string[];
  disqualifiers: string[];
  conflicts: string[];
  riskSignals: string[];
  existingGrantState: "NONE" | "ACTIVE";
  competingClaimState: "NONE" | "OPEN";
  identityRevalidated: boolean;
  automaticApproval: false;
};
export function evaluateClaimPolicy(input: {
  hub: string;
  profileClass: string;
  jurisdiction: string;
  relationship: RelationshipType;
  evidence: AuthorityEvidenceCode[];
  competingClaims: number;
  activeGrant: boolean;
  identityRevalidated: boolean;
  riskSignals?: string[];
}): PolicyEvaluation {
  const policy = claimPolicy(input.hub, input.profileClass, input.jurisdiction),
    evidence = [...new Set(input.evidence)],
    strong = evidence.filter(
      (code) =>
        AUTHORITY_EVIDENCE[code]?.authority &&
        AUTHORITY_EVIDENCE[code]?.independent,
    ),
    control = evidence.some((code) => AUTHORITY_EVIDENCE[code]?.control),
    disqualifiers = evidence.filter(
      (code) => policy?.disqualifiers.includes(code) ?? false,
    ),
    conflicts = evidence.filter(
      (code) => AUTHORITY_EVIDENCE[code]?.strength === "CONFLICT",
    ),
    step: string[] = [];
  const base = {
    policyVersion: policy?.policy_version ?? "NOT_YET_DEFINED",
    strongSignals: strong,
    missingEvidence: [] as string[],
    stepUpReasons: step,
    disqualifiers,
    conflicts,
    riskSignals: input.riskSignals ?? [],
    existingGrantState: input.activeGrant
      ? ("ACTIVE" as const)
      : ("NONE" as const),
    competingClaimState: input.competingClaims
      ? ("OPEN" as const)
      : ("NONE" as const),
    identityRevalidated: input.identityRevalidated,
    automaticApproval: false as const,
  };
  if (!policy)
    return {
      ...base,
      result: "NOT_YET_DEFINED",
      missingEvidence: ["DEFINED_POLICY_CELL"],
    };
  if (!input.identityRevalidated)
    base.missingEvidence.push("EXACT_PROFILE_REVALIDATED");
  if (!strong.length) base.missingEvidence.push("INDEPENDENT_AUTHORITY_SIGNAL");
  if (!control) base.missingEvidence.push("CONTROL_OR_CONTACT_SIGNAL");
  if (input.activeGrant) step.push("EXISTING_MANAGEMENT_GRANT_HOLD");
  if (input.competingClaims) step.push("COMPETING_CLAIM_HOLD");
  if (
    input.relationship === "third_party_representative" &&
    !evidence.includes("VERIFIED_OFFICER_AUTHORIZATION")
  )
    step.push("THIRD_PARTY_AUTHORITY_REQUIRED");
  if (evidence.includes("FREE_EMAIL_ACCOUNT")) step.push("FREE_EMAIL_STEP_UP");
  if (
    disqualifiers.length ||
    conflicts.length ||
    input.activeGrant ||
    input.competingClaims
  )
    return { ...base, result: "RED" };
  if (base.missingEvidence.length || step.length)
    return { ...base, result: "AMBER" };
  return { ...base, result: "GREEN" };
}
