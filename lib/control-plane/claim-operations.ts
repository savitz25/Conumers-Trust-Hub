import "server-only";
import type { SqlClient } from "@/lib/customer/sql";
import { customerPlatformForSql } from "@/lib/customer/server";
import type {
  AuthorityEvidenceCode,
  ClaimDecisionCategory,
} from "@/lib/customer/claim-governance";
import type { RelationshipType } from "@/lib/customer/types";
import { AdminSecurityService, type AdminRequestContext } from "./security";
import { evaluateClaimPolicy, type PolicyEvaluation } from "./claim-policy";

export type ClaimQueueFilter =
  | "all"
  | "green"
  | "amber"
  | "red"
  | "not_defined"
  | "competing"
  | "existing_grant"
  | "waiting"
  | "aged"
  | "pending";
export type ClaimQueueRow = {
  claimId: string;
  caseId: string;
  ageHours: number;
  ageBand: string;
  hub: string;
  profileClass: string;
  jurisdiction: string | null;
  displayName: string;
  identifierNamespace: string;
  identifier: string;
  claimStatus: string;
  caseStatus: string;
  workflowState: string;
  policy: PolicyEvaluation;
  existingGrant: boolean;
  competingClaims: number;
  assignedRole: string | null;
  nextAction: string;
};
const ageBand = (h: number) =>
  h < 24 ? "<24h" : h < 48 ? "24-48h" : h < 72 ? "48-72h" : ">72h";
const nextAction = (status: string) =>
  status === "needs_info"
    ? "Waiting for claimant"
    : status === "submitted"
      ? "Start review"
      : status === "in_review"
        ? "Continue review"
        : "View history";

export class ClaimOperationsService {
  constructor(
    private sql: SqlClient,
    private security: AdminSecurityService,
    private token: string,
    private ctx: AdminRequestContext,
  ) {}
  private async requireRead() {
    return this.security.require(this.token, "ADMIN_VIEW");
  }
  private async ensureCases() {
    await this.sql
      .query(`INSERT INTO ath_ops_cases(case_type,hub,jurisdiction,severity,status,workflow_state,target_ref,opened_at,internal_target_due_at,reason_codes)
    SELECT CASE WHEN EXISTS(SELECT 1 FROM ath_claims x WHERE x.hub_profile_id=c.hub_profile_id AND x.id<>c.id AND x.status IN('submitted','needs_info','in_review')) OR EXISTS(SELECT 1 FROM ath_management_grants g WHERE g.hub_profile_id=c.hub_profile_id AND g.status='active') THEN 'COMPETING_CLAIM' ELSE 'CLAIM_REVIEW' END,p.hub_id,NULLIF(p.home_state,'NA'),CASE WHEN c.status='in_review' THEN 'P1' ELSE 'P2' END,
    CASE WHEN c.status='needs_info' THEN 'WAITING' WHEN c.status IN('approved','rejected','withdrawn','superseded') THEN 'RESOLVED' ELSE 'OPEN' END,
    CASE c.status WHEN 'needs_info' THEN 'WAITING_FOR_CLAIMANT' WHEN 'approved' THEN 'RESOLVED_APPROVED' WHEN 'rejected' THEN 'RESOLVED_REJECTED' WHEN 'withdrawn' THEN 'RESOLVED_WITHDRAWN' WHEN 'superseded' THEN 'CLOSED' ELSE 'READY_FOR_REVIEW' END,c.id,c.created_at,c.created_at+interval '72 hours',ARRAY['CLAIM_DOMAIN_SYNC']
    FROM ath_claims c JOIN ath_hub_profiles p ON p.id=c.hub_profile_id ON CONFLICT(target_type,target_ref) DO NOTHING`);
  }
  async list(filter: ClaimQueueFilter = "all"): Promise<ClaimQueueRow[]> {
    await this.requireRead();
    await this.ensureCases();
    const rows = (
      await this.sql.query<
        Record<string, unknown>
      >(`SELECT c.id::text claim_id,oc.case_id::text,extract(epoch FROM(now()-c.created_at))/3600 age_hours,p.hub_id,COALESCE(p.entity_class,'unknown') profile_class,NULLIF(p.home_state,'NA') jurisdiction,COALESCE(p.display_name_snapshot,p.native_slug) display_name,COALESCE(p.identifier_namespace,'identifier') identifier_namespace,p.native_credential_key,c.status claim_status,oc.status case_status,oc.workflow_state,s.role assigned_role,c.relationship_type,c.free_email,
    EXISTS(SELECT 1 FROM ath_management_grants g WHERE g.hub_profile_id=c.hub_profile_id AND g.status='active') existing_grant,(SELECT count(*)::int FROM ath_claims x WHERE x.hub_profile_id=c.hub_profile_id AND x.id<>c.id AND x.status IN('submitted','needs_info','in_review')) competing_claims
    FROM ath_claims c JOIN ath_hub_profiles p ON p.id=c.hub_profile_id JOIN ath_ops_cases oc ON oc.target_ref=c.id LEFT JOIN ath_admin_staff s ON s.staff_id=oc.assigned_staff_id ORDER BY CASE WHEN c.status IN('submitted','needs_info','in_review') THEN 0 ELSE 1 END,c.created_at ASC LIMIT 250`)
    ).rows;
    return rows
      .map((r) => this.row(r))
      .filter(
        (r) =>
          filter === "all" ||
          (filter === "pending" &&
            ["submitted", "needs_info", "in_review"].includes(r.claimStatus)) ||
          (filter === "green" && r.policy.result === "GREEN") ||
          (filter === "amber" && r.policy.result === "AMBER") ||
          (filter === "red" && r.policy.result === "RED") ||
          (filter === "not_defined" && r.policy.result === "NOT_YET_DEFINED") ||
          (filter === "competing" && r.competingClaims > 0) ||
          (filter === "existing_grant" && r.existingGrant) ||
          (filter === "waiting" &&
            r.workflowState === "WAITING_FOR_CLAIMANT") ||
          (filter === "aged" && r.ageHours > 72),
      );
  }
  private row(r: Record<string, unknown>): ClaimQueueRow {
    const risk: string[] = [];
    if (r.free_email) risk.push("FREE_EMAIL_ACCOUNT");
    const policy = evaluateClaimPolicy({
      hub: String(r.hub_id),
      profileClass: String(r.profile_class),
      jurisdiction: String(r.jurisdiction ?? "*"),
      relationship: String(r.relationship_type) as RelationshipType,
      evidence: risk as AuthorityEvidenceCode[],
      competingClaims: Number(r.competing_claims),
      activeGrant: Boolean(r.existing_grant),
      identityRevalidated: true,
    });
    const h = Number(r.age_hours);
    return {
      claimId: String(r.claim_id),
      caseId: String(r.case_id),
      ageHours: h,
      ageBand: ageBand(h),
      hub: String(r.hub_id),
      profileClass: String(r.profile_class),
      jurisdiction: r.jurisdiction ? String(r.jurisdiction) : null,
      displayName: String(r.display_name),
      identifierNamespace: String(r.identifier_namespace),
      identifier: String(r.identifier),
      claimStatus: String(r.claim_status),
      caseStatus: String(r.case_status),
      workflowState: String(r.workflow_state),
      policy,
      existingGrant: Boolean(r.existing_grant),
      competingClaims: Number(r.competing_claims),
      assignedRole: r.assigned_role ? String(r.assigned_role) : null,
      nextAction: nextAction(String(r.claim_status)),
    };
  }
  async detail(claimId: string) {
    await this.requireRead();
    await this.ensureCases();
    const platform = customerPlatformForSql(this.sql),
      detail = await platform.getReviewDetail(this.token, claimId);
    const row = (await this.list("all")).find((x) => x.claimId === claimId);
    if (!row) throw new Error("claim_not_found");
    const evaluations = (
      await this.sql.query<Record<string, unknown>>(
        `SELECT policy_version,result,evaluated_at::text,strong_signals,missing_evidence,step_up_reasons,disqualifiers,conflicts,risk_signals,existing_grant_state,competing_claim_state,identity_revalidated,automatic_approval FROM ath_claim_policy_evaluations WHERE claim_id=$1 ORDER BY evaluated_at DESC LIMIT 20`,
        [claimId],
      )
    ).rows;
    return { ...detail, queue: row, evaluations };
  }
  async decide(
    claimId: string,
    input: {
      decision: "approve" | "reject" | "needs_info";
      evidenceCodes: AuthorityEvidenceCode[];
      evidenceNote: string;
      internalRationale: string;
      claimantMessage: string;
      reasonCategory: ClaimDecisionCategory;
      idempotencyKey: string;
    },
  ) {
    this.validateIdempotencyKey(input.idempotencyKey);
    const actor = await this.security.require(this.token, "CLAIM_OPS");
    await this.sql.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [input.idempotencyKey]);
    const existing = await this.sql.query<{ result: Record<string, unknown> }>(
      `SELECT result FROM ath_ops_case_events WHERE idempotency_key=$1`,
      [input.idempotencyKey],
    );
    if (existing.rows[0])
      return { ...existing.rows[0].result, idempotentReplay: true };
    const detail = await this.detail(claimId),
      q = detail.queue,
      evaluation = evaluateClaimPolicy({
        hub: q.hub,
        profileClass: q.profileClass,
        jurisdiction: q.jurisdiction ?? "*",
        relationship: String(
          detail.claim.relationship_type,
        ) as RelationshipType,
        evidence: input.evidenceCodes,
        competingClaims: q.competingClaims,
        activeGrant: q.existingGrant,
        identityRevalidated: true,
      });
    if (input.decision === "approve" && evaluation.result !== "GREEN")
      throw new Error("policy_blocks_approval");
    const platform = customerPlatformForSql(this.sql),
      before = String(detail.claim.status),
      result = await platform.staffDecide({
        sessionToken: this.token,
        claimId,
        decision: input.decision,
        evidenceCodes: input.evidenceCodes,
        evidenceNote: input.evidenceNote,
        internalRationale: input.internalRationale,
        claimantMessage: input.claimantMessage,
        reasonCategory: input.reasonCategory,
        ctx: { ip: this.ctx.ip, userAgent: this.ctx.userAgent },
      });
    const state =
        input.decision === "approve"
          ? "RESOLVED_APPROVED"
          : input.decision === "reject"
            ? "RESOLVED_REJECTED"
            : "WAITING_FOR_CLAIMANT",
      status = input.decision === "needs_info" ? "WAITING" : "RESOLVED";
    await this.persistEvaluation(q.caseId, claimId, evaluation);
    await this.sql.query(
      `UPDATE ath_ops_cases SET status=$2,workflow_state=$3,resolution=$4 WHERE case_id=$1`,
      [q.caseId, status, state, input.reasonCategory],
    );
    const payload = { ok: true, grantId: result.grantId ?? null };
    await this.sql.query(
      `INSERT INTO ath_ops_case_events(case_id,event_type,actor_staff_id,reason_code,from_state,to_state,idempotency_key,result)VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        q.caseId,
        `CLAIM_${input.decision.toUpperCase()}`,
        actor.staffId,
        input.reasonCategory,
        before,
        state,
        input.idempotencyKey,
        JSON.stringify(payload),
      ],
    );
    await this.security.recordClaimOperation(
      this.token,
      {
        eventType: `CLAIM_${input.decision.toUpperCase()}`,
        targetRef: claimId,
        reason: input.reasonCategory,
        result: "SUCCEEDED",
        before: { status: before },
        after: { status: state, policyResult: evaluation.result },
      },
      this.ctx,
    );
    return { ...payload, idempotentReplay: false };
  }
  async revoke(
    claimId: string,
    input: {
      grantId: string;
      internalReason: string;
      accountFacingReason: string;
      idempotencyKey: string;
    },
  ) {
    this.validateIdempotencyKey(input.idempotencyKey);
    const actor = await this.security.require(this.token, "CLAIM_OPS");
    await this.sql.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [input.idempotencyKey]);
    const existing = await this.sql.query<{ result: Record<string, unknown> }>(
      `SELECT result FROM ath_ops_case_events WHERE idempotency_key=$1`,
      [input.idempotencyKey],
    );
    if (existing.rows[0])
      return { ...existing.rows[0].result, idempotentReplay: true };
    const detail = await this.detail(claimId);
    if (!detail.grant || String(detail.grant.id) !== input.grantId)
      throw new Error("stale_grant");
    await customerPlatformForSql(this.sql).revokeGrant({
      sessionToken: this.token,
      grantId: input.grantId,
      reason: input.internalReason,
      accountFacingReason: input.accountFacingReason,
      ctx: { ip: this.ctx.ip, userAgent: this.ctx.userAgent },
    });
    const payload = { ok: true };
    await this.sql.query(
      `INSERT INTO ath_ops_case_events(case_id,event_type,actor_staff_id,reason_code,from_state,to_state,idempotency_key,result)VALUES($1,'MANAGEMENT_GRANT_REVOKED',$2,'MANAGEMENT_AUTHORITY_REVOKED','ACTIVE','REVOKED',$3,$4::jsonb)`,
      [
        detail.queue.caseId,
        actor.staffId,
        input.idempotencyKey,
        JSON.stringify(payload),
      ],
    );
    await this.security.recordClaimOperation(
      this.token,
      {
        eventType: "MANAGEMENT_GRANT_REVOKED",
        targetRef: claimId,
        reason: "MANAGEMENT_AUTHORITY_REVOKED",
        result: "SUCCEEDED",
        before: { grantStatus: "active" },
        after: { grantStatus: "revoked" },
      },
      this.ctx,
    );
    return { ...payload, idempotentReplay: false };
  }
  private async persistEvaluation(
    caseId: string,
    claimId: string,
    e: PolicyEvaluation,
  ) {
    await this.sql.query(
      `INSERT INTO ath_claim_policy_evaluations(case_id,claim_id,policy_version,result,strong_signals,missing_evidence,step_up_reasons,disqualifiers,conflicts,risk_signals,existing_grant_state,competing_claim_state,identity_revalidated,automatic_approval)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false)`,
      [
        caseId,
        claimId,
        e.policyVersion,
        e.result,
        e.strongSignals,
        e.missingEvidence,
        e.stepUpReasons,
        e.disqualifiers,
        e.conflicts,
        e.riskSignals,
        e.existingGrantState,
        e.competingClaimState,
        e.identityRevalidated,
      ],
    );
  }
  private validateIdempotencyKey(key: string) {
    if (!/^[A-Za-z0-9:_-]{8,160}$/.test(key)) throw new Error("invalid_idempotency_key");
  }
}
