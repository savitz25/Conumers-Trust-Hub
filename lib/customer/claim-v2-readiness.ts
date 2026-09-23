/**
 * ATH-CLAIM-V2-001 — portable Hub readiness contract (Section 9).
 *
 * This is a CERTIFICATION MODEL. It never flips a rollout mode, never reads or writes an env var, and never
 * awards READY because an adapter exists. Each requirement carries an evidence level:
 *   NOT_IMPLEMENTED            — no code path exists
 *   IMPLEMENTED                — code exists on main
 *   CERTIFIED                  — code exists AND a permanent automated test / browser QA proves it
 *   REAL_OWNER_CANARY_COMPLETE — at least one real non-Founder, non-QA organization completed the flow
 *   REVIEW_CAPACITY_MEASURED   — capacity metrics exist for real external claims
 */
import { CUSTOMER_HUBS, type CustomerHubId } from './types.ts';

export const READINESS_LEVELS = ['NOT_IMPLEMENTED', 'IMPLEMENTED', 'CERTIFIED', 'REAL_OWNER_CANARY_COMPLETE', 'REVIEW_CAPACITY_MEASURED'] as const;
export type ReadinessLevel = (typeof READINESS_LEVELS)[number];

export const ROLLOUT_STATES = ['OFF', 'CANARY', 'ALL'] as const;
export type RolloutState = (typeof ROLLOUT_STATES)[number];

export type ReadinessRequirementId =
  | 'R1_PUBLIC_INVENTORY' | 'R2_EXACT_IDENTITY' | 'R3_ADVERSE_EVIDENCE_RULES' | 'R4_AUTHORITY_PATH'
  | 'R5_REVOCATION_CERTIFIED' | 'R6_PUBLICATION_RESPONSE_CONTRACT' | 'R7_ABUSE_RESISTANT_START'
  | 'R8_REAL_OWNER_CANARY' | 'R9_REVIEW_CAPACITY';

export type ReadinessRequirement = { id: ReadinessRequirementId; gate: 'OFF_TO_CANARY' | 'CANARY_TO_ALL'; minimumLevel: ReadinessLevel; title: string; description: string };

export const CLAIM_V2_REQUIREMENTS: readonly ReadinessRequirement[] = [
  { id: 'R1_PUBLIC_INVENTORY', gate: 'OFF_TO_CANARY', minimumLevel: 'CERTIFIED', title: 'Meaningful public/indexable profile inventory', description: 'The Hub publishes non-thin, indexable profiles for the claimable class.' },
  { id: 'R2_EXACT_IDENTITY', gate: 'OFF_TO_CANARY', minimumLevel: 'CERTIFIED', title: 'Exact identifier binding', description: 'Native profile id + canonical identifier + slug/canonical URL are signed and revalidated by Ask.' },
  { id: 'R3_ADVERSE_EVIDENCE_RULES', gate: 'OFF_TO_CANARY', minimumLevel: 'CERTIFIED', title: 'Adverse evidence attribution/finality', description: 'If adverse evidence is published, it passes the Hub attribution and finality rules; claiming never changes it.' },
  { id: 'R4_AUTHORITY_PATH', gate: 'OFF_TO_CANARY', minimumLevel: 'CERTIFIED', title: 'Authority verification path defined', description: 'Claim policy cell exists (claim-policy.ts) and human governance applies.' },
  { id: 'R5_REVOCATION_CERTIFIED', gate: 'OFF_TO_CANARY', minimumLevel: 'CERTIFIED', title: 'Revocation behavior certified', description: 'Revoking the grant withdraws every business-supplied projection on the Hub.' },
  { id: 'R6_PUBLICATION_RESPONSE_CONTRACT', gate: 'OFF_TO_CANARY', minimumLevel: 'CERTIFIED', title: 'Business publication + response contract frozen', description: 'Hub renders Ask public business profile and responses with unmistakable provenance labels.' },
  { id: 'R7_ABUSE_RESISTANT_START', gate: 'OFF_TO_CANARY', minimumLevel: 'CERTIFIED', title: 'Abuse-resistant handoff start certified', description: 'GET cannot mint; explicit POST with same-origin + abuse gate mints one short-lived token; passive Ask view creates no durable intent.' },
  { id: 'R8_REAL_OWNER_CANARY', gate: 'CANARY_TO_ALL', minimumLevel: 'REAL_OWNER_CANARY_COMPLETE', title: 'Real non-Founder / non-QA organization completed end-to-end', description: 'A legitimate consenting business completed claim → review → active grant → business-supplied publication.' },
  { id: 'R9_REVIEW_CAPACITY', gate: 'CANARY_TO_ALL', minimumLevel: 'REVIEW_CAPACITY_MEASURED', title: 'Review capacity measured and supportable', description: 'Evidence-ready rate, human review minutes, needs-info rate, SLA state exist for real external claims.' },
] as const;

export type HubReadinessAssessment = {
  hub: CustomerHubId;
  implementation: string;
  requirements: Record<ReadinessRequirementId, { level: ReadinessLevel; evidence: string }>;
};

export type HubReadinessReport = HubReadinessAssessment & {
  offToCanary: 'MET' | 'NOT_MET';
  canaryToAll: 'MET' | 'NOT_MET';
  blocking: ReadinessRequirementId[];
  recommendedRolloutState: RolloutState;
  note: string;
};

const order = (level: ReadinessLevel) => READINESS_LEVELS.indexOf(level);

export function evaluateHubReadiness(assessment: HubReadinessAssessment): HubReadinessReport {
  const blocking: ReadinessRequirementId[] = [];
  let offToCanary: 'MET' | 'NOT_MET' = 'MET';
  let canaryToAll: 'MET' | 'NOT_MET' = 'MET';
  for (const req of CLAIM_V2_REQUIREMENTS) {
    const actual = assessment.requirements[req.id];
    const met = actual && order(actual.level) >= order(req.minimumLevel);
    if (!met) {
      blocking.push(req.id);
      if (req.gate === 'OFF_TO_CANARY') offToCanary = 'NOT_MET';
      canaryToAll = 'NOT_MET';
    }
  }
  const recommendedRolloutState: RolloutState = offToCanary === 'MET' && canaryToAll === 'MET' ? 'ALL' : offToCanary === 'MET' ? 'CANARY' : 'OFF';
  return { ...assessment, offToCanary, canaryToAll, blocking, recommendedRolloutState, note: 'Certification model only. This value never changes a production rollout flag.' };
}

/**
 * Current six-Hub assessment from the ATH-CLAIM-V2-001 read-only inspection (inventory doc, Section 3).
 * Levels reflect real current capabilities at the starting mains, plus this ticket's Contractor branch.
 */
export const CLAIM_V2_HUB_ASSESSMENTS: readonly HubReadinessAssessment[] = [
  {
    hub: 'contractor',
    implementation: 'V2 reference implementation (this branch): POST claim start, same-origin + bounded abuse gate, GET returns 405 with zero mints; Ask passive receipt → explicit Continue.',
    requirements: {
      R1_PUBLIC_INVENTORY: { level: 'CERTIFIED', evidence: 'FL DBPR non-thin profiles; eligibility excludes thin/non-FL (test_ath_cust_003).' },
      R2_EXACT_IDENTITY: { level: 'CERTIFIED', evidence: 'UUID + credential + slug + canonical URL signed; Ask adapter rejects any swap (platform.test, ath-launch-001a, ath-claim-v2-001).' },
      R3_ADVERSE_EVIDENCE_RULES: { level: 'CERTIFIED', evidence: 'Discipline cohort remains unpublished; publication_state untouched (test:fl-safety invariants).' },
      R4_AUTHORITY_PATH: { level: 'CERTIFIED', evidence: 'claim-policy cell contractor/contractor; ath-claim-governance-001 scenarios.' },
      R5_REVOCATION_CERTIFIED: { level: 'CERTIFIED', evidence: 'Revoked grant removes public projection (ath-claim-publish-001, ath-claim-v2-001 R).' },
      R6_PUBLICATION_RESPONSE_CONTRACT: { level: 'CERTIFIED', evidence: 'BusinessSuppliedProfile + BusinessResponses contracts with provenance labels (test_ath_claim_publish_001).' },
      R7_ABUSE_RESISTANT_START: { level: 'CERTIFIED', evidence: '1,000 GET → 0 mints; POST + origin + rate limit (test_ath_claim_v2_001); Ask 1,000 receipts → 0 intents (ath-claim-v2-001).' },
      R8_REAL_OWNER_CANARY: { level: 'CERTIFIED', evidence: 'PENDING_FOUNDER_CANARY: no real non-Founder organization has completed the flow. Historical approvals were proof claims with revoked grants.' },
      R9_REVIEW_CAPACITY: { level: 'IMPLEMENTED', evidence: 'Timer, evidence-ready flag, SLA state exist; no real external claim measured yet.' },
    },
  },
  {
    hub: 'move',
    implementation: 'Specialist mints on GET (/api/claim/handoff/[profileId]); CTA goes through /portal/claim page first; no claim-route rate limit.',
    requirements: {
      R1_PUBLIC_INVENTORY: { level: 'IMPLEMENTED', evidence: 'USDOT mover profiles published nationally.' },
      R2_EXACT_IDENTITY: { level: 'CERTIFIED', evidence: 'Ask validates USDOT + slug via specialist-execution v2 (ath-cust-011a).' },
      R3_ADVERSE_EVIDENCE_RULES: { level: 'IMPLEMENTED', evidence: 'Hub-owned attribution rules; not re-certified by this ticket.' },
      R4_AUTHORITY_PATH: { level: 'CERTIFIED', evidence: 'claim-policy cell move/mover.' },
      R5_REVOCATION_CERTIFIED: { level: 'IMPLEMENTED', evidence: 'Ask projection requires active grant; Hub-side render not re-certified.' },
      R6_PUBLICATION_RESPONSE_CONTRACT: { level: 'IMPLEMENTED', evidence: 'Hub consumes Ask public contracts; provenance labels not re-verified here.' },
      R7_ABUSE_RESISTANT_START: { level: 'NOT_IMPLEMENTED', evidence: 'GET mints a signed handoff. Ask-side passive receipt protects durable intent, but specialist mint is unbounded.' },
      R8_REAL_OWNER_CANARY: { level: 'NOT_IMPLEMENTED', evidence: 'No real owner canary.' },
      R9_REVIEW_CAPACITY: { level: 'NOT_IMPLEMENTED', evidence: 'No external claims measured.' },
    },
  },
  {
    hub: 'lender',
    implementation: 'Specialist mints on GET; institution-only; no rate limit.',
    requirements: {
      R1_PUBLIC_INVENTORY: { level: 'IMPLEMENTED', evidence: 'NMLS institution profiles; branch/MLO excluded.' },
      R2_EXACT_IDENTITY: { level: 'CERTIFIED', evidence: 'Ask validates NMLS + slug (ath-cust-011a).' },
      R3_ADVERSE_EVIDENCE_RULES: { level: 'IMPLEMENTED', evidence: 'Hub-owned; not re-certified.' },
      R4_AUTHORITY_PATH: { level: 'CERTIFIED', evidence: 'claim-policy cell lender/institution.' },
      R5_REVOCATION_CERTIFIED: { level: 'IMPLEMENTED', evidence: 'Ask projection gated; Hub render not re-certified.' },
      R6_PUBLICATION_RESPONSE_CONTRACT: { level: 'IMPLEMENTED', evidence: 'Hub consumes Ask contracts.' },
      R7_ABUSE_RESISTANT_START: { level: 'NOT_IMPLEMENTED', evidence: 'GET mints.' },
      R8_REAL_OWNER_CANARY: { level: 'NOT_IMPLEMENTED', evidence: 'None.' },
      R9_REVIEW_CAPACITY: { level: 'NOT_IMPLEMENTED', evidence: 'None.' },
    },
  },
  {
    hub: 'senior',
    implementation: 'Specialist mints on GET per provider class + CCN; Ask validates via locked v1 contract; no rate limit.',
    requirements: {
      R1_PUBLIC_INVENTORY: { level: 'IMPLEMENTED', evidence: 'CMS nursing home / home health / hospice profiles.' },
      R2_EXACT_IDENTITY: { level: 'CERTIFIED', evidence: 'Fingerprint-locked validation contract (ath-cust-012a).' },
      R3_ADVERSE_EVIDENCE_RULES: { level: 'IMPLEMENTED', evidence: 'Hub-owned; not re-certified.' },
      R4_AUTHORITY_PATH: { level: 'CERTIFIED', evidence: 'claim-policy cells for three provider classes.' },
      R5_REVOCATION_CERTIFIED: { level: 'IMPLEMENTED', evidence: 'Ask projection gated; Hub render not re-certified.' },
      R6_PUBLICATION_RESPONSE_CONTRACT: { level: 'IMPLEMENTED', evidence: 'Hub consumes Ask contracts.' },
      R7_ABUSE_RESISTANT_START: { level: 'NOT_IMPLEMENTED', evidence: 'GET mints.' },
      R8_REAL_OWNER_CANARY: { level: 'NOT_IMPLEMENTED', evidence: 'None.' },
      R9_REVIEW_CAPACITY: { level: 'NOT_IMPLEMENTED', evidence: 'None.' },
    },
  },
  {
    hub: 'insurance',
    implementation: 'Specialist mints on GET after local validation; legal insurers only; recovery page exists; no rate limit. Agency claims out of scope.',
    requirements: {
      R1_PUBLIC_INVENTORY: { level: 'IMPLEMENTED', evidence: 'Published legal insurer pilot rows.' },
      R2_EXACT_IDENTITY: { level: 'CERTIFIED', evidence: 'Locked v1 validation contract (ath-cust-014a).' },
      R3_ADVERSE_EVIDENCE_RULES: { level: 'IMPLEMENTED', evidence: 'Hub-owned; not re-certified.' },
      R4_AUTHORITY_PATH: { level: 'CERTIFIED', evidence: 'claim-policy cell insurance/legal_insurer.' },
      R5_REVOCATION_CERTIFIED: { level: 'IMPLEMENTED', evidence: 'Ask projection gated; Hub render not re-certified.' },
      R6_PUBLICATION_RESPONSE_CONTRACT: { level: 'IMPLEMENTED', evidence: 'Hub consumes Ask contracts.' },
      R7_ABUSE_RESISTANT_START: { level: 'NOT_IMPLEMENTED', evidence: 'GET mints.' },
      R8_REAL_OWNER_CANARY: { level: 'NOT_IMPLEMENTED', evidence: 'None.' },
      R9_REVIEW_CAPACITY: { level: 'NOT_IMPLEMENTED', evidence: 'None.' },
    },
  },
  {
    hub: 'investor',
    implementation: 'Specialist mints on GET; firm-only; no rate limit.',
    requirements: {
      R1_PUBLIC_INVENTORY: { level: 'IMPLEMENTED', evidence: 'CRD firm profiles.' },
      R2_EXACT_IDENTITY: { level: 'CERTIFIED', evidence: 'Locked v1 validation contract (ath-cust-013a).' },
      R3_ADVERSE_EVIDENCE_RULES: { level: 'IMPLEMENTED', evidence: 'Hub-owned; not re-certified.' },
      R4_AUTHORITY_PATH: { level: 'CERTIFIED', evidence: 'claim-policy cell investor/firm.' },
      R5_REVOCATION_CERTIFIED: { level: 'IMPLEMENTED', evidence: 'Ask projection gated; Hub render not re-certified.' },
      R6_PUBLICATION_RESPONSE_CONTRACT: { level: 'IMPLEMENTED', evidence: 'Hub consumes Ask contracts.' },
      R7_ABUSE_RESISTANT_START: { level: 'NOT_IMPLEMENTED', evidence: 'GET mints.' },
      R8_REAL_OWNER_CANARY: { level: 'NOT_IMPLEMENTED', evidence: 'None.' },
      R9_REVIEW_CAPACITY: { level: 'NOT_IMPLEMENTED', evidence: 'None.' },
    },
  },
];

export function sixHubReadinessReport(): HubReadinessReport[] {
  return CUSTOMER_HUBS.map((hub) => {
    const assessment = CLAIM_V2_HUB_ASSESSMENTS.find((a) => a.hub === hub);
    if (!assessment) throw new Error(`missing readiness assessment for ${hub}`);
    return evaluateHubReadiness(assessment);
  });
}
