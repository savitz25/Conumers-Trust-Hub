import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  AUTHORITY_EVIDENCE,
  evaluateAuthority,
  isFreeEmail,
  responseModerationWarnings,
  type AuthorityEvidenceCode,
  type GovernanceResult,
} from "./claim-governance.ts";
import type { RelationshipType } from "./types.ts";

type Scenario = {
  name: string;
  evidence: AuthorityEvidenceCode[];
  expected: GovernanceResult;
  relationship?: RelationshipType;
  competingClaims?: number;
  activeGrant?: boolean;
};
const scenarios: Scenario[] = [
  {
    name: "competitor knows license number",
    evidence: ["CREDENTIAL_KNOWLEDGE"],
    expected: "NEEDS_INFO",
  },
  {
    name: "competitor free email claims owner",
    evidence: ["FREE_EMAIL_ACCOUNT", "CREDENTIAL_KNOWLEDGE"],
    expected: "NEEDS_INFO",
  },
  {
    name: "former employee retains domain email",
    evidence: ["FORMER_EMPLOYEE_OR_OFFICER", "COMPANY_DOMAIN_CONTROL"],
    expected: "CONFLICT",
  },
  {
    name: "marketing agency claims owner",
    evidence: ["THIRD_PARTY_AGENCY", "COMPANY_DOMAIN_CONTROL"],
    expected: "CONFLICT",
  },
  {
    name: "agency manager no officer authorization",
    relationship: "third_party_representative",
    evidence: ["COMPANY_DOMAIN_CONTROL", "CORROBORATING_BUSINESS_RECORD"],
    expected: "NEEDS_INFO",
  },
  {
    name: "office manager authorized by verified officer",
    relationship: "authorized_manager",
    evidence: ["VERIFIED_OFFICER_AUTHORIZATION", "COMPANY_DOMAIN_CONTROL"],
    expected: "APPROVE",
  },
  {
    name: "current officer and domain",
    relationship: "officer",
    evidence: ["CORPORATE_OFFICER_MATCH", "COMPANY_DOMAIN_CONTROL"],
    expected: "APPROVE",
  },
  {
    name: "domain matches but officer does not",
    evidence: ["COMPANY_DOMAIN_CONTROL", "IDENTITY_MISMATCH"],
    expected: "CONFLICT",
  },
  {
    name: "officer uses Gmail without second control",
    relationship: "officer",
    evidence: ["CORPORATE_OFFICER_MATCH", "FREE_EMAIL_ACCOUNT"],
    expected: "NEEDS_INFO",
  },
  {
    name: "independent callback plus officer match",
    evidence: ["VERIFIED_PUBLIC_CALLBACK", "CORPORATE_OFFICER_MATCH"],
    expected: "APPROVE",
  },
  {
    name: "claimant supplied callback only",
    evidence: ["CLAIMANT_SUPPLIED_CONTACT", "CREDENTIAL_KNOWLEDGE"],
    expected: "NEEDS_INFO",
  },
  {
    name: "same surname as owner",
    evidence: ["LINKEDIN_OR_BUSINESS_CARD", "CREDENTIAL_KNOWLEDGE"],
    expected: "NEEDS_INFO",
  },
  {
    name: "public LinkedIn says employee",
    relationship: "employee",
    evidence: ["LINKEDIN_OR_BUSINESS_CARD", "COMPANY_DOMAIN_CONTROL"],
    expected: "NEEDS_INFO",
  },
  {
    name: "copies public DBPR facts",
    evidence: ["CREDENTIAL_KNOWLEDGE", "CORROBORATING_BUSINESS_RECORD"],
    expected: "NEEDS_INFO",
  },
  {
    name: "qualifier without control",
    relationship: "qualifying_agent",
    evidence: ["REGULATOR_QUALIFIER_MATCH", "CREDENTIAL_KNOWLEDGE"],
    expected: "NEEDS_INFO",
  },
  {
    name: "qualifier authorized and called back",
    relationship: "qualifying_agent",
    evidence: ["REGULATOR_QUALIFIER_MATCH", "VERIFIED_PUBLIC_CALLBACK"],
    expected: "APPROVE",
  },
  {
    name: "officer authorizes staff member",
    relationship: "employee",
    evidence: ["VERIFIED_OFFICER_AUTHORIZATION", "COMPANY_DOMAIN_CONTROL"],
    expected: "APPROVE",
  },
  {
    name: "stale former officer",
    evidence: ["FORMER_EMPLOYEE_OR_OFFICER", "CORPORATE_OFFICER_MATCH"],
    expected: "CONFLICT",
  },
  {
    name: "current competing pending claim",
    evidence: ["CORPORATE_OFFICER_MATCH", "COMPANY_DOMAIN_CONTROL"],
    competingClaims: 1,
    expected: "CONFLICT",
  },
  {
    name: "active grant exists",
    evidence: ["CORPORATE_OFFICER_MATCH", "COMPANY_DOMAIN_CONTROL"],
    activeGrant: true,
    expected: "CONFLICT",
  },
  {
    name: "legitimate second employee should be invited",
    relationship: "employee",
    evidence: ["EXISTING_VERIFIED_ORG_AUTHORITY", "COMPANY_DOMAIN_CONTROL"],
    activeGrant: true,
    expected: "CONFLICT",
  },
  {
    name: "agency access after owner authorization",
    relationship: "third_party_representative",
    evidence: ["VERIFIED_OFFICER_AUTHORIZATION", "COMPANY_DOMAIN_CONTROL"],
    expected: "APPROVE",
  },
  {
    name: "acquisition new owner",
    evidence: ["CORPORATE_OFFICER_MATCH", "VERIFIED_PUBLIC_CALLBACK"],
    expected: "APPROVE",
  },
  {
    name: "DBA name change alone",
    evidence: ["CREDENTIAL_KNOWLEDGE", "CORROBORATING_BUSINESS_RECORD"],
    expected: "NEEDS_INFO",
  },
  {
    name: "new successor license must stay exact",
    evidence: ["IDENTITY_MISMATCH", "CORPORATE_OFFICER_MATCH"],
    expected: "CONFLICT",
  },
  {
    name: "lost email recovery assertion",
    evidence: ["CLAIMANT_SUPPLIED_CONTACT", "CREDENTIAL_KNOWLEDGE"],
    expected: "NEEDS_INFO",
  },
  {
    name: "asks staff to bypass verification",
    evidence: ["BYPASS_REQUEST", "COMPANY_DOMAIN_CONTROL"],
    expected: "CONFLICT",
  },
  {
    name: "legal threat during claim is not authority",
    evidence: ["CREDENTIAL_KNOWLEDGE", "CLAIMANT_SUPPLIED_CONTACT"],
    expected: "NEEDS_INFO",
  },
  {
    name: "claimed fraudulent document no corroboration",
    evidence: ["IDENTITY_MISMATCH", "CORROBORATING_BUSINESS_RECORD"],
    expected: "CONFLICT",
  },
  {
    name: "high confidence Contractor owner",
    evidence: ["CORPORATE_OFFICER_MATCH", "PREEXISTING_COMPANY_CONTACT"],
    expected: "APPROVE",
  },
  {
    name: "credential plus company email still insufficient",
    evidence: ["CREDENTIAL_KNOWLEDGE", "COMPANY_DOMAIN_CONTROL"],
    expected: "NEEDS_INFO",
  },
  {
    name: "existing verified org expands exact profile",
    evidence: [
      "EXISTING_VERIFIED_ORG_AUTHORITY",
      "PREEXISTING_COMPANY_CONTACT",
    ],
    expected: "APPROVE",
  },
  {
    name: "contradictory callback blocks",
    evidence: ["CORPORATE_OFFICER_MATCH", "CONTRADICTORY_CALLBACK"],
    expected: "CONFLICT",
  },
  {
    name: "officer authorization plus public contact",
    evidence: ["VERIFIED_OFFICER_AUTHORIZATION", "PREEXISTING_COMPANY_CONTACT"],
    expected: "APPROVE",
  },
  {
    name: "free email plus two independent checks",
    evidence: [
      "FREE_EMAIL_ACCOUNT",
      "CORPORATE_OFFICER_MATCH",
      "VERIFIED_PUBLIC_CALLBACK",
    ],
    expected: "APPROVE",
  },
];

test("35 realistic human claim scenarios follow the Contractor V1 rubric", () => {
  assert.ok(scenarios.length >= 30);
  for (const scenario of scenarios) {
    const actual = evaluateAuthority({
      hub: "contractor",
      relationship: scenario.relationship || "owner",
      evidence: scenario.evidence,
      competingClaims: scenario.competingClaims,
      activeGrant: scenario.activeGrant,
    });
    assert.equal(actual.result, scenario.expected, scenario.name);
  }
});
test("domain, credential, and public facts cannot approve alone or together", () => {
  for (const evidence of [
    ["COMPANY_DOMAIN_CONTROL"],
    ["CREDENTIAL_KNOWLEDGE"],
    ["COMPANY_DOMAIN_CONTROL", "CREDENTIAL_KNOWLEDGE"],
  ] as AuthorityEvidenceCode[][])
    assert.equal(
      evaluateAuthority({ hub: "contractor", relationship: "owner", evidence })
        .eligibleForHumanApproval,
      false,
    );
});
test("evidence catalog is stable and explicitly classifies weak/conflict signals", () => {
  assert.equal(
    AUTHORITY_EVIDENCE.COMPANY_DOMAIN_CONTROL.strength,
    "SUPPORTING",
  );
  assert.equal(AUTHORITY_EVIDENCE.CREDENTIAL_KNOWLEDGE.strength, "WEAK");
  assert.equal(
    AUTHORITY_EVIDENCE.FORMER_EMPLOYEE_OR_OFFICER.strength,
    "CONFLICT",
  );
});
test("free email is escalation rather than rejection", () => {
  assert.equal(isFreeEmail("Owner@GMAIL.com"), true);
  assert.equal(
    evaluateAuthority({
      hub: "contractor",
      relationship: "owner",
      evidence: ["FREE_EMAIL_ACCOUNT", "CORPORATE_OFFICER_MATCH"],
    }).result,
    "NEEDS_INFO",
  );
});
test("response warnings identify PII, secrets, HTML, threats, and external links", () => {
  const flags = responseModerationWarnings(
    "<img src=x> Call 317-555-1212 or a@b.com with the password https://evil.test",
  );
  for (const flag of [
    "HTML_OR_SCRIPT",
    "PHONE_NUMBER",
    "EMAIL_ADDRESS",
    "AUTH_SECRET",
    "UNSUPPORTED_EXTERNAL_LINK",
  ])
    assert.ok(flags.includes(flag as never));
});
test("real review surface separates governance fields and revocation stays staff-only", () => {
  const store = readFileSync("lib/customer/store.ts", "utf8"),
    ui = readFileSync("app/internal/review/[id]/review-actions.tsx", "utf8"),
    route = readFileSync("app/api/internal/review/[id]/route.ts", "utf8");
  assert.match(store, /evaluateAuthority/);
  assert.match(store, /competingCount/);
  assert.match(store, /internal_rationale/);
  assert.match(store, /claimant_facing_reason/);
  assert.match(store, /requireStaff\(input\.sessionToken\)/);
  assert.doesNotMatch(ui, /License key matches the pointed/);
  for (const field of [
    "evidenceCodes",
    "evidenceNote",
    "internalRationale",
    "claimantMessage",
  ])
    assert.match(route, new RegExp(field));
});
test("revocation preserves history and active access queries exclude revoked grants", () => {
  const store = readFileSync("lib/customer/store.ts", "utf8");
  assert.match(store, /SET status = 'revoked'/);
  assert.match(store, /action:\s*["']grant_revoked["']/);
  assert.match(store, /g\.status = 'active'/);
  assert.doesNotMatch(store, /DELETE FROM ath_management_grants/);
});
test("abuse caps cover front-door, correction, response, invitation, and review actions", () => {
  const store = readFileSync("lib/customer/store.ts", "utf8");
  for (const bucket of [
    "claim_submit_user",
    "record_issue_submit",
    "record_issue_customer_action",
    "business_reply_write",
    "business_reply_customer_action",
    "organization_invite_actor",
    "organization_invite_resend",
    "review_staff",
  ])
    assert.match(store, new RegExp(bucket));
});
test("required operational governance documents are checked in", () => {
  for (const name of [
    "authority-standard",
    "reviewer-runbook",
    "wrongful-claim-runbook",
    "access-exit-runbook",
    "business-response-moderation",
    "record-issue-review",
    "legal-escalation-runbook",
    "trial-sla",
  ])
    assert.ok(
      readFileSync(`docs/claim-governance/${name}.md`, "utf8").length > 200,
      name,
    );
});
test("governance adds no identity-bearing client analytics", () => {
  const files = [
    "lib/customer/claim-governance.ts",
    "app/internal/review/[id]/review-actions.tsx",
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /trackEvent|profile_id|claim_id|organization_id/,
    );
  }
});
