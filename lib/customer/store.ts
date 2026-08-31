import { loadAndValidateProfile, type CthDirectory } from './adapter.ts';
import { hashToken, isEmailShape, normalizeEmail, randomToken } from './crypto.ts';
import { createHash } from 'node:crypto';
import {
  approvedEmail,
  claimReceivedEmail,
  loginEmail,
  needsInfoEmail,
  rejectedEmail,
  recordIssueEmail,
  businessReplyEmail,
} from './copy.ts';
import { isFreeEmail } from './free-email.ts';
import { HandoffError, parseAndAuthenticateHandoff } from './handoff.ts';
import { customerLog } from './log.ts';
import type { Mailer } from './mail.ts';
import { one, type SqlClient } from './sql.ts';
import { validateBusinessProfile, type BusinessProfileInput } from './business-profile.ts';
import { businessFreshness, oldestConfirmation } from './freshness.ts';
import { PUBLIC_BUSINESS_FIELD_KEYS, type PublicBusinessProfile } from './public-profile.ts';
import { CUSTOMER_TRANSITIONS, RECORD_ISSUE_TYPES, STAFF_TRANSITIONS, RecordIssueError, validateRecordIssue, type RecordIssueStatus } from './record-issues.ts';
import { BUSINESS_REPLY_STATUSES, BusinessReplyError, STAFF_REPLY_TRANSITIONS, validateBusinessReply, type BusinessReplyStatus } from './business-replies.ts';
import type { PublicBusinessReplies } from './public-replies.ts';
import type {
  ClaimStatus,
  GrantStatus,
  HandoffPayload,
  MembershipRole,
  RelationshipType,
  RequestContext,
  VerificationMethod,
} from './types.ts';

const MAGIC_TTL_MS = 30 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class AuthError extends Error {
  readonly code:
    | 'invalid_email'
    | 'expired_link'
    | 'consumed_link'
    | 'missing_session'
    | 'rate_limited'
    | 'not_staff'
    | 'not_confirmed';
  constructor(
    code:
      | 'invalid_email'
      | 'expired_link'
      | 'consumed_link'
      | 'missing_session'
      | 'rate_limited'
      | 'not_staff'
      | 'not_confirmed'
  ) {
    super(code);
    this.name = 'AuthError';
    this.code = code;
  }
}

export class ClaimError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'ClaimError';
    this.code = code;
  }
}

export class ManagementError extends Error {
  readonly code: 'forbidden' | 'not_found' | 'stale_version';
  constructor(code: 'forbidden' | 'not_found' | 'stale_version') {
    super(code);
    this.name = 'ManagementError';
    this.code = code;
  }
}

export type PlatformDeps = {
  sql: SqlClient;
  cth: CthDirectory;
  mailer: Mailer;
  handoffSecret: string;
  staffEmails: string[];
  siteUrl: string;
  now?: () => Date;
};

function staffSet(emails: string[]): Set<string> {
  return new Set(emails.map((e) => normalizeEmail(e)).filter(Boolean));
}

export class CustomerPlatform {
  private readonly deps: PlatformDeps;
  constructor(deps: PlatformDeps) {
    this.deps = deps;
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  private isStaffEmail(email: string): boolean {
    return staffSet(this.deps.staffEmails).has(normalizeEmail(email));
  }

  async hitRateLimit(bucket: string, key: string, max: number, windowMs: number): Promise<void> {
    const since = new Date(this.now().getTime() - windowMs).toISOString();
    const row = await one<{ n: string }>(
      this.deps.sql,
      `SELECT COUNT(*)::text AS n FROM ath_rate_events
        WHERE bucket = $1 AND rate_key = $2 AND created_at >= $3`,
      [bucket, key, since]
    );
    const n = Number(row?.n || 0);
    if (n >= max) {
      customerLog('rate_limited', { bucket, key }, 'warn');
      throw new AuthError('rate_limited');
    }
    await this.deps.sql.query(
      `INSERT INTO ath_rate_events (bucket, rate_key, created_at) VALUES ($1, $2, $3)`,
      [bucket, key, this.now().toISOString()]
    );
  }

  async audit(input: {
    actorUserId?: string | null;
    actorKind?: 'user' | 'staff' | 'system';
    orgId?: string | null;
    objectType: string;
    objectId?: string | null;
    action: string;
    before?: unknown;
    after?: unknown;
    ctx?: RequestContext;
  }): Promise<void> {
    await this.deps.sql.query(
      `INSERT INTO ath_audit_events
        (actor_user_id, actor_kind, org_id, object_type, object_id, action, before_state, after_state, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10)`,
      [
        input.actorUserId ?? null,
        input.actorKind ?? 'user',
        input.orgId ?? null,
        input.objectType,
        input.objectId ?? null,
        input.action,
        input.before ? JSON.stringify(input.before) : null,
        input.after ? JSON.stringify(input.after) : null,
        input.ctx?.ip ?? null,
        input.ctx?.userAgent ?? null,
      ]
    );
  }

  async requestMagicLink(input: {
    email: string;
    purpose?: 'login' | 'confirm_email' | 'claim_continue';
    nextPath?: string;
    ctx?: RequestContext;
  }): Promise<{ sent: boolean; preview?: string }> {
    const email = normalizeEmail(input.email);
    if (!isEmailShape(email)) throw new AuthError('invalid_email');
    try {
      await this.hitRateLimit('auth_link_email', email, 5, 15 * 60 * 1000);
      if (input.ctx?.ip) await this.hitRateLimit('auth_link_ip', input.ctx.ip, 20, 15 * 60 * 1000);
    } catch (e) {
      if (e instanceof AuthError && e.code === 'rate_limited') throw e;
      throw e;
    }

    let user = await one<{ id: string }>(
      this.deps.sql,
      `SELECT id FROM ath_users WHERE email_normalized = $1`,
      [email]
    );
    if (!user) {
      user = await one<{ id: string }>(
        this.deps.sql,
        `INSERT INTO ath_users (email, email_normalized, status) VALUES ($1,$1,'pending') RETURNING id`,
        [email]
      );
    }

    const token = randomToken(32);
    const expires = new Date(this.now().getTime() + MAGIC_TTL_MS);
    await this.deps.sql.query(
      `INSERT INTO ath_auth_challenges
        (email_normalized, user_id, purpose, token_hash, expires_at, request_ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        email,
        user!.id,
        input.purpose ?? 'login',
        hashToken(token),
        expires.toISOString(),
        input.ctx?.ip ?? null,
        input.ctx?.userAgent ?? null,
      ]
    );

    const next = input.nextPath && input.nextPath.startsWith('/') ? input.nextPath : '/claim/continue';
    const magicUrl = `${this.deps.siteUrl.replace(/\/$/, '')}/api/customer/auth/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
    const mail = loginEmail(magicUrl);
    customerLog('auth_challenge_created', { purpose: input.purpose ?? 'login' });
    const result = await this.deps.mailer({ to: email, ...mail });
    return result;
  }

  async consumeMagicLink(
    token: string,
    ctx?: RequestContext
  ): Promise<{ sessionToken: string; userId: string; email: string }> {
    const tokenHash = hashToken(token);
    const row = await one<{
      id: string;
      email_normalized: string;
      user_id: string | null;
      expires_at: string;
      consumed_at: string | null;
    }>(
      this.deps.sql,
      `SELECT id, email_normalized, user_id, expires_at::text, consumed_at::text
         FROM ath_auth_challenges WHERE token_hash = $1`,
      [tokenHash]
    );
    if (!row) throw new AuthError('expired_link');
    if (row.consumed_at) throw new AuthError('consumed_link');
    if (new Date(row.expires_at).getTime() < this.now().getTime()) throw new AuthError('expired_link');

    await this.deps.sql.query(
      `UPDATE ath_auth_challenges SET consumed_at = $2, attempt_count = attempt_count + 1 WHERE id = $1`,
      [row.id, this.now().toISOString()]
    );

    const user = await one<{ id: string; email: string; email_confirmed_at: string | null }>(
      this.deps.sql,
      `UPDATE ath_users
          SET email_confirmed_at = COALESCE(email_confirmed_at, $2::timestamptz),
              status = CASE WHEN status = 'pending' THEN 'active' ELSE status END
        WHERE email_normalized = $1
        RETURNING id, email, email_confirmed_at::text`,
      [row.email_normalized, this.now().toISOString()]
    );
    if (!user) throw new AuthError('expired_link');

    const sessionToken = randomToken(32);
    const expires = new Date(this.now().getTime() + SESSION_TTL_MS);
    await this.deps.sql.query(
      `INSERT INTO ath_sessions (user_id, token_hash, expires_at, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5)`,
      [user.id, hashToken(sessionToken), expires.toISOString(), ctx?.ip ?? null, ctx?.userAgent ?? null]
    );
    await this.audit({
      actorUserId: user.id,
      action: 'login_confirmed',
      objectType: 'ath_users',
      objectId: user.id,
      ctx,
    });
    customerLog('auth_login_confirmed', { userId: user.id });
    return { sessionToken, userId: user.id, email: user.email };
  }

  async sessionUser(sessionToken: string | null | undefined): Promise<{
    id: string;
    email: string;
    emailConfirmedAt: string | null;
    isStaff: boolean;
  } | null> {
    if (!sessionToken) return null;
    const row = await one<{
      id: string;
      email: string;
      email_confirmed_at: string | null;
      expires_at: string;
      revoked_at: string | null;
      session_id: string;
    }>(
      this.deps.sql,
      `SELECT u.id, u.email, u.email_confirmed_at::text, s.expires_at::text, s.revoked_at::text, s.id AS session_id
         FROM ath_sessions s
         JOIN ath_users u ON u.id = s.user_id
        WHERE s.token_hash = $1`,
      [hashToken(sessionToken)]
    );
    if (!row || row.revoked_at) return null;
    if (new Date(row.expires_at).getTime() < this.now().getTime()) return null;
    await this.deps.sql.query(`UPDATE ath_sessions SET last_seen_at = $2 WHERE id = $1`, [
      row.session_id,
      this.now().toISOString(),
    ]);
    return {
      id: row.id,
      email: row.email,
      emailConfirmedAt: row.email_confirmed_at,
      isStaff: this.isStaffEmail(row.email),
    };
  }

  async logout(sessionToken: string | null | undefined): Promise<void> {
    if (!sessionToken) return;
    await this.deps.sql.query(
      `UPDATE ath_sessions SET revoked_at = $2 WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hashToken(sessionToken), this.now().toISOString()]
    );
  }

  async acceptHandoff(token: string, ctx?: RequestContext): Promise<{
    intentId: string;
    payload: HandoffPayload;
    displayName: string;
    profileHref: string;
  }> {
    if (ctx?.ip) {
      try {
        await this.hitRateLimit('handoff_ip', ctx.ip, 30, 15 * 60 * 1000);
      } catch {
        throw new ClaimError('rate_limited');
      }
    }
    let payload: HandoffPayload;
    try {
      payload = parseAndAuthenticateHandoff(this.deps.handoffSecret, token, this.now());
    } catch (e) {
      const code = e instanceof HandoffError ? e.code : 'malformed';
      customerLog('handoff_rejected', { code }, 'warn');
      throw e;
    }

    const existingNonce = await one<{ consumed: boolean }>(
      this.deps.sql,
      `SELECT (consumed_at IS NOT NULL) AS consumed FROM ath_claim_intents WHERE nonce = $1`,
      [payload.nonce]
    );
    if (existingNonce) {
      customerLog('handoff_rejected', { code: 'reused_nonce' }, 'warn');
      throw new HandoffError('reused_nonce');
    }

    const adapter = await loadAndValidateProfile(this.deps.cth, payload);
    if (!adapter.ok) {
      customerLog('handoff_adapter_rejected', { code: adapter.code }, 'warn');
      throw new ClaimError(adapter.code);
    }

    const intent = await one<{ id: string }>(
      this.deps.sql,
      `INSERT INTO ath_claim_intents (nonce, payload, expires_at)
       VALUES ($1, $2::jsonb, to_timestamp($3))
       RETURNING id`,
      [payload.nonce, JSON.stringify(payload), payload.exp]
    );
    await this.audit({
      actorKind: 'system',
      action: 'handoff_accepted',
      objectType: 'ath_claim_intents',
      objectId: intent!.id,
      after: {
        native_profile_id: payload.native_profile_id,
        slug: payload.slug,
        external_key: payload.external_key,
      },
      ctx,
    });
    return {
      intentId: intent!.id,
      payload,
      displayName: adapter.profile.displayName,
      profileHref: `https://www.contractortrusthub.com/contractors/${adapter.profile.slug}`,
    };
  }

  async intentPreview(intentId: string): Promise<{
    payload: HandoffPayload;
    displayName: string;
    profileHref: string;
    consumed: boolean;
  } | null> {
    const row = await one<{ payload: HandoffPayload; consumed_at: string | null; expires_at: string }>(
      this.deps.sql,
      `SELECT payload, consumed_at::text, expires_at::text FROM ath_claim_intents WHERE id = $1`,
      [intentId]
    );
    if (!row) return null;
    if (new Date(row.expires_at).getTime() < this.now().getTime()) return null;
    const payload = (
      typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload
    ) as HandoffPayload;
    const adapter = await loadAndValidateProfile(this.deps.cth, payload);
    if (!adapter.ok) return null;
    return {
      payload,
      displayName: adapter.profile.displayName,
      profileHref: `https://www.contractortrusthub.com/contractors/${adapter.profile.slug}`,
      consumed: Boolean(row.consumed_at),
    };
  }

  async submitClaim(input: {
    sessionToken: string;
    intentId: string;
    relationshipType: RelationshipType;
    legalName?: string;
    credentialAttestation: string;
    authorized: boolean;
    ctx?: RequestContext;
  }): Promise<{ claimId: string; orgId: string; status: ClaimStatus; competing: boolean }> {
    const user = await this.sessionUser(input.sessionToken);
    if (!user) throw new AuthError('missing_session');
    if (!user.emailConfirmedAt) throw new AuthError('not_confirmed');
    if (!input.authorized) throw new ClaimError('forbidden');
    try {
      await this.hitRateLimit('claim_submit_user', user.id, 8, 60 * 60 * 1000);
    } catch {
      throw new ClaimError('rate_limited');
    }

    const intent = await this.intentPreview(input.intentId);
    if (!intent) throw new ClaimError('missing_intent');
    if (intent.consumed) throw new ClaimError('intent_consumed');

    const adapter = await loadAndValidateProfile(this.deps.cth, intent.payload);
    if (!adapter.ok) throw new ClaimError(adapter.code);

    const hub = await one<{ id: string }>(
      this.deps.sql,
      `INSERT INTO ath_hub_profiles
        (hub_id, native_profile_id, native_slug, native_credential_key, native_source_system, home_state, display_name_snapshot, last_validated_at)
       VALUES ('contractor', $1, $2, $3, 'fl_dbpr', 'FL', $4, $5)
       ON CONFLICT (hub_id, native_profile_id) DO UPDATE SET
         native_slug = EXCLUDED.native_slug,
         native_credential_key = EXCLUDED.native_credential_key,
         display_name_snapshot = EXCLUDED.display_name_snapshot,
         last_validated_at = EXCLUDED.last_validated_at
       RETURNING id`,
      [
        intent.payload.native_profile_id,
        adapter.profile.slug,
        adapter.profile.externalKey,
        adapter.profile.displayName,
        this.now().toISOString(),
      ]
    );

    const existingGrant = await one<{ id: string; org_id: string; status: GrantStatus }>(
      this.deps.sql,
      `SELECT id, org_id, status FROM ath_management_grants
        WHERE hub_profile_id = $1 AND status = 'active'`,
      [hub!.id]
    );

    const orgName = (input.legalName || adapter.profile.displayName).trim();
    const org = await one<{ id: string }>(
      this.deps.sql,
      `INSERT INTO ath_organizations (display_name, legal_name, status)
       VALUES ($1,$2,'active') RETURNING id`,
      [orgName, input.legalName?.trim() || null]
    );

    await this.deps.sql.query(
      `INSERT INTO ath_memberships (org_id, user_id, role, status)
       VALUES ($1,$2,'owner','invited')`,
      [org!.id, user.id]
    );

    const freeEmail = isFreeEmail(user.email);
    const verificationMethod: VerificationMethod = 'manual_review';
    const competing = Boolean(existingGrant);
    const status: ClaimStatus = competing ? 'in_review' : 'submitted';
    const workType = competing ? 'competing_claim' : 'claim_review';
    const risk = competing ? 'competing' : freeEmail ? 'free_email' : 'standard';

    const claim = await one<{ id: string }>(
      this.deps.sql,
      `INSERT INTO ath_claims
        (org_id, hub_profile_id, claimant_user_id, status, verification_method,
         relationship_type, free_email, attestation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       RETURNING id`,
      [
        org!.id,
        hub!.id,
        user.id,
        status,
        verificationMethod,
        input.relationshipType,
        freeEmail,
        JSON.stringify({
          authorized: true,
          credential_attestation: input.credentialAttestation.trim(),
          legal_name: input.legalName?.trim() || null,
          display_name: adapter.profile.displayName,
          expected_external_key: adapter.profile.externalKey,
          competing,
          document_upload: 'deferred',
        }),
      ]
    );

    await this.deps.sql.query(
      `UPDATE ath_claim_intents SET consumed_at = $2 WHERE id = $1`,
      [input.intentId, this.now().toISOString()]
    );

    await this.deps.sql.query(
      `INSERT INTO ath_review_queue (work_type, object_type, object_id, status, risk_state)
       VALUES ($1, 'ath_claims', $2, 'open', $3)`,
      [workType, claim!.id, risk]
    );

    // Competing request is queued. The existing active grant is left untouched.

    await this.audit({
      actorUserId: user.id,
      orgId: org!.id,
      objectType: 'ath_claims',
      objectId: claim!.id,
      action: 'claim_created',
      after: { status, competing, free_email: freeEmail },
      ctx: input.ctx,
    });
    customerLog('claim_submitted', { claimId: claim!.id, competing, freeEmail });

    const mail = claimReceivedEmail({
      displayName: adapter.profile.displayName,
      credentialKey: adapter.profile.externalKey,
      status,
    });
    await this.deps.mailer({ to: user.email, ...mail });

    return { claimId: claim!.id, orgId: org!.id, status, competing };
  }

  async getClaimForUser(sessionToken: string, claimId: string) {
    const user = await this.sessionUser(sessionToken);
    if (!user) throw new AuthError('missing_session');
    const row = await one<Record<string, unknown>>(
      this.deps.sql,
      `SELECT c.id, c.status, c.free_email, c.relationship_type, c.decision_reason,
              c.org_id, c.hub_profile_id, c.claimant_user_id,
              o.display_name AS org_name,
              p.native_slug, p.native_credential_key, p.native_profile_id, p.display_name_snapshot,
              m.role AS membership_role, m.status AS membership_status
         FROM ath_claims c
         JOIN ath_organizations o ON o.id = c.org_id
         JOIN ath_hub_profiles p ON p.id = c.hub_profile_id
         JOIN ath_memberships m ON m.org_id = c.org_id AND m.user_id = $2
        WHERE c.id = $1 AND c.claimant_user_id = $2`,
      [claimId, user.id]
    );
    if (!row) throw new ClaimError('forbidden');
    return row;
  }

  async listOpenReviews(sessionToken: string) {
    const user = await this.requireStaff(sessionToken);
    void user;
    const res = await this.deps.sql.query(
      `SELECT q.id, q.work_type, q.risk_state, q.status, q.created_at,
              c.id AS claim_id, c.status AS claim_status, c.free_email,
              u.email AS claimant_email,
              p.native_slug, p.native_credential_key, p.display_name_snapshot
         FROM ath_review_queue q
         JOIN ath_claims c ON c.id = q.object_id
         JOIN ath_users u ON u.id = c.claimant_user_id
         JOIN ath_hub_profiles p ON p.id = c.hub_profile_id
        WHERE q.status IN ('open','in_progress') AND q.object_type = 'ath_claims'
        ORDER BY q.created_at ASC`
    );
    return res.rows;
  }

  async getReviewDetail(sessionToken: string, claimId: string) {
    await this.requireStaff(sessionToken);
    const claim = await one<Record<string, unknown>>(
      this.deps.sql,
      `SELECT c.*, u.email AS claimant_email, u.email_confirmed_at,
              o.display_name AS org_name,
              p.native_profile_id, p.native_slug, p.native_credential_key, p.display_name_snapshot, p.home_state
         FROM ath_claims c
         JOIN ath_users u ON u.id = c.claimant_user_id
         JOIN ath_organizations o ON o.id = c.org_id
         JOIN ath_hub_profiles p ON p.id = c.hub_profile_id
        WHERE c.id = $1`,
      [claimId]
    );
    if (!claim) throw new ClaimError('missing_intent');
    const grant = await one<Record<string, unknown>>(
      this.deps.sql,
      `SELECT * FROM ath_management_grants WHERE hub_profile_id = $1 AND status = 'active'`,
      [claim.hub_profile_id]
    );
    const competing = await this.deps.sql.query(
      `SELECT id, status, claimant_user_id, created_at FROM ath_claims
        WHERE hub_profile_id = $1 AND id <> $2
        ORDER BY created_at DESC`,
      [claim.hub_profile_id, claimId]
    );
    const audit = await this.deps.sql.query(
      `SELECT action, actor_kind, created_at, after_state FROM ath_audit_events
        WHERE object_id = $1 OR (object_type = 'ath_claims' AND object_id = $1)
        ORDER BY created_at ASC`,
      [claimId]
    );
    return { claim, grant, competing: competing.rows, audit: audit.rows };
  }

  private async requireStaff(sessionToken: string) {
    const user = await this.sessionUser(sessionToken);
    if (!user) throw new AuthError('missing_session');
    if (!user.isStaff) throw new AuthError('not_staff');
    return user;
  }

  async staffDecide(input: {
    sessionToken: string;
    claimId: string;
    decision: 'approve' | 'reject' | 'needs_info';
    reason: string;
    ctx?: RequestContext;
  }): Promise<{ grantId?: string }> {
    const staff = await this.requireStaff(input.sessionToken);
    try {
      await this.hitRateLimit('review_staff', staff.id, 60, 60 * 60 * 1000);
    } catch {
      throw new AuthError('rate_limited');
    }

    const claim = await one<{
      id: string;
      org_id: string;
      hub_profile_id: string;
      claimant_user_id: string;
      status: ClaimStatus;
    }>(this.deps.sql, `SELECT id, org_id, hub_profile_id, claimant_user_id, status FROM ath_claims WHERE id = $1`, [
      input.claimId,
    ]);
    if (!claim) throw new ClaimError('missing_intent');
    if (claim.status === 'rejected') throw new ClaimError('rejected_claim');

    const profile = await one<{ display_name_snapshot: string; native_slug: string }>(
      this.deps.sql,
      `SELECT display_name_snapshot, native_slug FROM ath_hub_profiles WHERE id = $1`,
      [claim.hub_profile_id]
    );
    const claimant = await one<{ email: string }>(
      this.deps.sql,
      `SELECT email FROM ath_users WHERE id = $1`,
      [claim.claimant_user_id]
    );

    if (input.decision === 'needs_info') {
      await this.deps.sql.query(
        `UPDATE ath_claims SET status = 'needs_info', reviewed_at = $2, reviewed_by = $3, decision_reason = $4 WHERE id = $1`,
        [claim.id, this.now().toISOString(), staff.id, input.reason]
      );
      await this.audit({
        actorUserId: staff.id,
        actorKind: 'staff',
        orgId: claim.org_id,
        objectType: 'ath_claims',
        objectId: claim.id,
        action: 'claim_needs_info',
        before: { status: claim.status },
        after: { status: 'needs_info' },
        ctx: input.ctx,
      });
      customerLog('staff_decision', { decision: 'needs_info', claimId: claim.id });
      if (claimant && profile) {
        const mail = needsInfoEmail({
          displayName: profile.display_name_snapshot || profile.native_slug,
          nextAction: input.reason,
        });
        await this.deps.mailer({ to: claimant.email, ...mail });
      }
      return {};
    }

    if (input.decision === 'reject') {
      await this.deps.sql.query(
        `UPDATE ath_claims SET status = 'rejected', reviewed_at = $2, reviewed_by = $3, decision_reason = $4 WHERE id = $1`,
        [claim.id, this.now().toISOString(), staff.id, input.reason]
      );
      await this.deps.sql.query(
        `UPDATE ath_review_queue SET status = 'resolved', resolved_at = $2
          WHERE object_id = $1 AND object_type = 'ath_claims' AND status IN ('open','in_progress')`,
        [claim.id, this.now().toISOString()]
      );
      await this.audit({
        actorUserId: staff.id,
        actorKind: 'staff',
        orgId: claim.org_id,
        objectType: 'ath_claims',
        objectId: claim.id,
        action: 'claim_rejected',
        before: { status: claim.status },
        after: { status: 'rejected' },
        ctx: input.ctx,
      });
      customerLog('staff_decision', { decision: 'reject', claimId: claim.id });
      if (claimant && profile) {
        const mail = rejectedEmail({
          displayName: profile.display_name_snapshot || profile.native_slug,
          reason: input.reason,
        });
        await this.deps.mailer({ to: claimant.email, ...mail });
      }
      return {};
    }

    const active = await one<{ id: string }>(
      this.deps.sql,
      `SELECT id FROM ath_management_grants WHERE hub_profile_id = $1 AND status = 'active'`,
      [claim.hub_profile_id]
    );
    if (active) {
      await this.deps.sql.query(
        `UPDATE ath_claims SET status = 'in_review', reviewed_at = $2, reviewed_by = $3, decision_reason = $4 WHERE id = $1`,
        [
          claim.id,
          this.now().toISOString(),
          staff.id,
          'Competing request: an active management grant already exists. The existing grant was not transferred.',
        ]
      );
      await this.deps.sql.query(
        `UPDATE ath_review_queue SET work_type = 'competing_claim', risk_state = 'competing'
          WHERE object_id = $1 AND object_type = 'ath_claims'`,
        [claim.id]
      );
      await this.audit({
        actorUserId: staff.id,
        actorKind: 'staff',
        orgId: claim.org_id,
        objectType: 'ath_claims',
        objectId: claim.id,
        action: 'competing_claim_blocked_transfer',
        after: { existing_grant_id: active.id },
        ctx: input.ctx,
      });
      throw new ClaimError('already_granted_elsewhere');
    }

    await this.deps.sql.query(
      `UPDATE ath_claims SET status = 'approved', reviewed_at = $2, reviewed_by = $3, decision_reason = $4 WHERE id = $1`,
      [claim.id, this.now().toISOString(), staff.id, input.reason]
    );
    await this.deps.sql.query(
      `UPDATE ath_memberships SET status = 'active', role = 'owner'
        WHERE org_id = $1 AND user_id = $2`,
      [claim.org_id, claim.claimant_user_id]
    );
    const grant = await one<{ id: string }>(
      this.deps.sql,
      `INSERT INTO ath_management_grants
        (org_id, hub_profile_id, status, granted_from_claim_id, granted_by, granted_at)
       VALUES ($1,$2,'active',$3,$4,$5)
       RETURNING id`,
      [claim.org_id, claim.hub_profile_id, claim.id, staff.id, this.now().toISOString()]
    );
    await this.deps.sql.query(
      `UPDATE ath_review_queue SET status = 'resolved', resolved_at = $2
        WHERE object_id = $1 AND object_type = 'ath_claims' AND status IN ('open','in_progress')`,
      [claim.id, this.now().toISOString()]
    );
    await this.audit({
      actorUserId: staff.id,
      actorKind: 'staff',
      orgId: claim.org_id,
      objectType: 'ath_claims',
      objectId: claim.id,
      action: 'claim_approved',
      before: { status: claim.status },
      after: { status: 'approved' },
      ctx: input.ctx,
    });
    await this.audit({
      actorUserId: staff.id,
      actorKind: 'staff',
      orgId: claim.org_id,
      objectType: 'ath_management_grants',
      objectId: grant!.id,
      action: 'grant_created',
      after: { status: 'active', hub_profile_id: claim.hub_profile_id },
      ctx: input.ctx,
    });
    await this.audit({
      actorUserId: staff.id,
      actorKind: 'staff',
      orgId: claim.org_id,
      objectType: 'ath_memberships',
      objectId: claim.org_id,
      action: 'membership_activated',
      after: { user_id: claim.claimant_user_id, role: 'owner' },
      ctx: input.ctx,
    });
    customerLog('grant_created', { grantId: grant!.id, claimId: claim.id });
    customerLog('staff_decision', { decision: 'approve', claimId: claim.id });

    if (claimant && profile) {
      const mail = approvedEmail({
        displayName: profile.display_name_snapshot || profile.native_slug,
        manageUrl: `${this.deps.siteUrl.replace(/\/$/, '')}/manage`,
      });
      await this.deps.mailer({ to: claimant.email, ...mail });
    }
    return { grantId: grant!.id };
  }

  async revokeGrant(input: {
    sessionToken: string;
    grantId: string;
    reason: string;
    ctx?: RequestContext;
  }): Promise<void> {
    const staff = await this.requireStaff(input.sessionToken);
    const grant = await one<{ id: string; org_id: string; status: string }>(
      this.deps.sql,
      `SELECT id, org_id, status FROM ath_management_grants WHERE id = $1`,
      [input.grantId]
    );
    if (!grant) throw new ClaimError('missing_intent');
    await this.deps.sql.query(
      `UPDATE ath_management_grants
          SET status = 'revoked', revoked_at = $2, revoked_by = $3, revocation_reason = $4
        WHERE id = $1`,
      [input.grantId, this.now().toISOString(), staff.id, input.reason]
    );
    await this.audit({
      actorUserId: staff.id,
      actorKind: 'staff',
      orgId: grant.org_id,
      objectType: 'ath_management_grants',
      objectId: grant.id,
      action: 'grant_revoked',
      before: { status: grant.status },
      after: { status: 'revoked' },
      ctx: input.ctx,
    });
    customerLog('grant_revoked', { grantId: grant.id });
  }

  private async requireProfileAccess(sessionToken: string, nativeProfileId: string, write = false) {
    const user = await this.sessionUser(sessionToken);
    if (!user) throw new AuthError('missing_session');
    const access = await one<{
      user_id: string; org_id: string; hub_profile_id: string; role: MembershipRole;
      native_profile_id: string; native_slug: string; native_credential_key: string;
      display_name_snapshot: string | null;
    }>(this.deps.sql,
      `SELECT u.id AS user_id, o.id AS org_id, p.id AS hub_profile_id, m.role,
              p.native_profile_id::text, p.native_slug, p.native_credential_key, p.display_name_snapshot
         FROM ath_users u
         JOIN ath_memberships m ON m.user_id = u.id AND m.status = 'active'
         JOIN ath_organizations o ON o.id = m.org_id AND o.status = 'active'
         JOIN ath_management_grants g ON g.org_id = o.id AND g.status = 'active'
         JOIN ath_hub_profiles p ON p.id = g.hub_profile_id
        WHERE u.id = $1 AND p.native_profile_id = $2::uuid`,
      [user.id, nativeProfileId]
    );
    if (!access) throw new ManagementError('forbidden');
    if (write && !['owner', 'manager', 'staff'].includes(access.role)) throw new ManagementError('forbidden');
    return access;
  }

  async businessProfile(sessionToken: string, nativeProfileId: string) {
    const access = await this.requireProfileAccess(sessionToken, nativeProfileId);
    // withPlatform uses one transactional pg Client; keep its queries sequential.
    const revision = await one<{ version: number }>(this.deps.sql,
      `SELECT version FROM ath_business_profile_revisions WHERE org_id=$1 AND hub_profile_id=$2`,
      [access.org_id, access.hub_profile_id]);
    const fields = await this.deps.sql.query<{ field_key: string; value_text: string; supplied_by_user_id: string; first_supplied_at: string; updated_at: string; last_confirmed_at: string; source: string }>(
        `SELECT field_key,value_text,supplied_by_user_id,first_supplied_at::text,updated_at::text,last_confirmed_at::text,source
           FROM ath_business_profile_fields WHERE org_id=$1 AND hub_profile_id=$2 ORDER BY field_key`,
        [access.org_id, access.hub_profile_id]);
    const items = await this.deps.sql.query<{ category: string; value_text: string; position: number; supplied_by_user_id: string; first_supplied_at: string; updated_at: string; last_confirmed_at: string; source: string }>(
        `SELECT category,value_text,position,supplied_by_user_id,first_supplied_at::text,updated_at::text,last_confirmed_at::text,source
           FROM ath_business_profile_items WHERE org_id=$1 AND hub_profile_id=$2 ORDER BY category,position`,
        [access.org_id, access.hub_profile_id]);
    const hours = await this.deps.sql.query<{ weekday: number; is_closed: boolean; opens_at: string | null; closes_at: string | null; supplied_by_user_id: string; first_supplied_at: string; updated_at: string; last_confirmed_at: string; source: string }>(
        `SELECT weekday,is_closed,opens_at::text,closes_at::text,supplied_by_user_id,first_supplied_at::text,updated_at::text,last_confirmed_at::text,source
           FROM ath_business_profile_hours WHERE org_id=$1 AND hub_profile_id=$2 ORDER BY weekday`,
        [access.org_id, access.hub_profile_id]);
    const activity = await this.deps.sql.query<{ action: string; created_at: string; actor_user_id: string | null }>(
        `SELECT action,created_at::text,actor_user_id FROM ath_audit_events
          WHERE org_id=$1 AND object_type='ath_business_profile' AND object_id=$2
          ORDER BY created_at DESC LIMIT 10`, [access.org_id, access.hub_profile_id]);
    const confirmed = oldestConfirmation([...fields.rows, ...items.rows, ...hours.rows]);
    return { access, version: revision?.version ?? 0, fields: fields.rows, items: items.rows, hours: hours.rows, activity: activity.rows,
      freshness: confirmed ? businessFreshness(confirmed, this.now()) : null };
  }

  async publicBusinessProfile(nativeProfileId: string): Promise<PublicBusinessProfile | null> {
    const profile = await one<{ org_id: string; hub_profile_id: string; native_profile_id: string }>(this.deps.sql,
      `SELECT g.org_id,p.id AS hub_profile_id,p.native_profile_id::text
         FROM ath_management_grants g
         JOIN ath_organizations o ON o.id=g.org_id AND o.status='active'
         JOIN ath_hub_profiles p ON p.id=g.hub_profile_id AND p.hub_id='contractor'
        WHERE p.native_profile_id=$1::uuid AND g.status='active'
          AND EXISTS (SELECT 1 FROM ath_memberships m WHERE m.org_id=g.org_id AND m.status='active' AND m.role IN ('owner','manager','staff'))`,
      [nativeProfileId]);
    if (!profile) return null;
    const fields = await this.deps.sql.query<{ field_key: string; value_text: string; last_confirmed_at: string }>(
      `SELECT field_key,value_text,last_confirmed_at::text FROM ath_business_profile_fields
        WHERE org_id=$1 AND hub_profile_id=$2 AND field_key=ANY($3::text[]) ORDER BY field_key`,
      [profile.org_id, profile.hub_profile_id, [...PUBLIC_BUSINESS_FIELD_KEYS]]);
    const items = await this.deps.sql.query<{ category: string; value_text: string; position: number; last_confirmed_at: string }>(
      `SELECT category,value_text,position,last_confirmed_at::text FROM ath_business_profile_items
        WHERE org_id=$1 AND hub_profile_id=$2 AND category IN ('service','service_area','language') ORDER BY category,position`,
      [profile.org_id, profile.hub_profile_id]);
    const hours = await this.deps.sql.query<{ weekday: number; is_closed: boolean; opens_at: string | null; closes_at: string | null; last_confirmed_at: string }>(
      `SELECT weekday,is_closed,opens_at::text,closes_at::text,last_confirmed_at::text FROM ath_business_profile_hours
        WHERE org_id=$1 AND hub_profile_id=$2 ORDER BY weekday`, [profile.org_id, profile.hub_profile_id]);
    const confirmations = [...fields.rows, ...items.rows, ...hours.rows];
    const confirmed = oldestConfirmation(confirmations);
    if (!confirmed) return null;
    const publicFields: PublicBusinessProfile['fields'] = {};
    for (const row of fields.rows) {
      if (PUBLIC_BUSINESS_FIELD_KEYS.includes(row.field_key as (typeof PUBLIC_BUSINESS_FIELD_KEYS)[number])) {
        publicFields[row.field_key as keyof typeof publicFields] = row.value_text;
      }
    }
    const values = (category: string) => items.rows.filter((row) => row.category === category).map((row) => row.value_text);
    return { contractVersion: 1, hub: 'contractor', nativeProfileId: profile.native_profile_id, managed: true,
      source: 'BUSINESS_SUPPLIED', freshness: businessFreshness(confirmed, this.now()), fields: publicFields,
      services: values('service'), serviceAreas: values('service_area'), languages: values('language'),
      hours: hours.rows.map((row) => ({ weekday: Number(row.weekday), closed: row.is_closed,
        opensAt: row.opens_at?.slice(0, 5), closesAt: row.closes_at?.slice(0, 5) })) };
  }

  async reconfirmBusinessProfile(input: { sessionToken: string; nativeProfileId: string; version: number; ctx?: RequestContext }) {
    const access = await this.requireProfileAccess(input.sessionToken, input.nativeProfileId, true);
    const revision = await one<{ version: number }>(this.deps.sql,
      `SELECT version FROM ath_business_profile_revisions WHERE org_id=$1 AND hub_profile_id=$2 FOR UPDATE`,
      [access.org_id, access.hub_profile_id]);
    if (!revision || revision.version !== input.version) throw new ManagementError('stale_version');
    const now = this.now().toISOString();
    let affected = 0;
    for (const table of ['ath_business_profile_fields','ath_business_profile_items','ath_business_profile_hours']) {
      const result = await this.deps.sql.query<{ count: string }>(
        `WITH changed AS (UPDATE ${table} SET last_confirmed_at=$3,supplied_by_user_id=$4,version=version+1
          WHERE org_id=$1 AND hub_profile_id=$2 RETURNING 1) SELECT COUNT(*)::text AS count FROM changed`,
        [access.org_id, access.hub_profile_id, now, access.user_id]);
      affected += Number(result.rows[0]?.count ?? 0);
    }
    if (!affected) throw new ManagementError('not_found');
    const nextVersion = revision.version + 1;
    await this.deps.sql.query(`UPDATE ath_business_profile_revisions SET version=$3,updated_at=$4 WHERE org_id=$1 AND hub_profile_id=$2`,
      [access.org_id, access.hub_profile_id, nextVersion, now]);
    await this.audit({ actorUserId: access.user_id, orgId: access.org_id, objectType: 'ath_business_profile',
      objectId: access.hub_profile_id, action: 'business_info_reconfirmed',
      before: { version: revision.version }, after: { version: nextVersion, last_confirmed_at: now, field_count: affected }, ctx: input.ctx });
    return { version: nextVersion, freshness: businessFreshness(now, this.now()) };
  }

  async saveBusinessProfile(input: { sessionToken: string; nativeProfileId: string; body: unknown; ctx?: RequestContext }) {
    const access = await this.requireProfileAccess(input.sessionToken, input.nativeProfileId, true);
    const data: BusinessProfileInput = validateBusinessProfile(input.body, this.now());
    await this.deps.sql.query(
      `INSERT INTO ath_business_profile_revisions (org_id,hub_profile_id,version) VALUES ($1,$2,0)
       ON CONFLICT (org_id,hub_profile_id) DO NOTHING`, [access.org_id, access.hub_profile_id]);
    const revision = await one<{ version: number }>(this.deps.sql,
      `SELECT version FROM ath_business_profile_revisions WHERE org_id=$1 AND hub_profile_id=$2 FOR UPDATE`,
      [access.org_id, access.hub_profile_id]);
    if (!revision || revision.version !== data.version) throw new ManagementError('stale_version');
    const before = await this.businessProfile(input.sessionToken, input.nativeProfileId);
    const now = this.now().toISOString();

    for (const [key, value] of Object.entries(data.fields)) {
      await this.deps.sql.query(
        `INSERT INTO ath_business_profile_fields
          (org_id,hub_profile_id,field_key,value_text,supplied_by_user_id,first_supplied_at,last_confirmed_at,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$6,$6,$6)
         ON CONFLICT (org_id,hub_profile_id,field_key) DO UPDATE SET
           value_text=EXCLUDED.value_text,supplied_by_user_id=EXCLUDED.supplied_by_user_id,
           last_confirmed_at=EXCLUDED.last_confirmed_at,updated_at=EXCLUDED.updated_at,
           version=ath_business_profile_fields.version+1`,
        [access.org_id, access.hub_profile_id, key, value, access.user_id, now]);
    }
    await this.deps.sql.query(
      `DELETE FROM ath_business_profile_fields WHERE org_id=$1 AND hub_profile_id=$2 AND NOT (field_key = ANY($3::text[]))`,
      [access.org_id, access.hub_profile_id, Object.keys(data.fields)]);

    const groups = { service: data.services, service_area: data.serviceAreas, language: data.languages } as const;
    for (const [category, values] of Object.entries(groups)) {
      await this.deps.sql.query(
        `DELETE FROM ath_business_profile_items WHERE org_id=$1 AND hub_profile_id=$2 AND category=$3 AND NOT (value_text = ANY($4::text[]))`,
        [access.org_id, access.hub_profile_id, category, values]);
      for (const [position, value] of values.entries()) {
        await this.deps.sql.query(
          `INSERT INTO ath_business_profile_items
            (org_id,hub_profile_id,category,value_text,position,supplied_by_user_id,first_supplied_at,last_confirmed_at,created_at,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$7,$7)
           ON CONFLICT (org_id,hub_profile_id,category,value_text) DO UPDATE SET
             position=EXCLUDED.position,supplied_by_user_id=EXCLUDED.supplied_by_user_id,
             last_confirmed_at=EXCLUDED.last_confirmed_at,updated_at=EXCLUDED.updated_at,
             version=ath_business_profile_items.version+1`,
          [access.org_id, access.hub_profile_id, category, value, position, access.user_id, now]);
      }
    }

    await this.deps.sql.query(
      `DELETE FROM ath_business_profile_hours WHERE org_id=$1 AND hub_profile_id=$2 AND NOT (weekday = ANY($3::smallint[]))`,
      [access.org_id, access.hub_profile_id, data.hours.map((h) => h.weekday)]);
    for (const h of data.hours) {
      await this.deps.sql.query(
        `INSERT INTO ath_business_profile_hours
          (org_id,hub_profile_id,weekday,is_closed,opens_at,closes_at,supplied_by_user_id,first_supplied_at,last_confirmed_at,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5::time,$6::time,$7,$8,$8,$8,$8)
         ON CONFLICT (org_id,hub_profile_id,weekday) DO UPDATE SET
           is_closed=EXCLUDED.is_closed,opens_at=EXCLUDED.opens_at,closes_at=EXCLUDED.closes_at,
           supplied_by_user_id=EXCLUDED.supplied_by_user_id,last_confirmed_at=EXCLUDED.last_confirmed_at,
           updated_at=EXCLUDED.updated_at,version=ath_business_profile_hours.version+1`,
        [access.org_id, access.hub_profile_id, h.weekday, h.closed, h.opensAt ?? null, h.closesAt ?? null, access.user_id, now]);
    }
    const nextVersion = revision.version + 1;
    await this.deps.sql.query(
      `UPDATE ath_business_profile_revisions SET version=$3,updated_at=$4 WHERE org_id=$1 AND hub_profile_id=$2`,
      [access.org_id, access.hub_profile_id, nextVersion, now]);
    await this.audit({ actorUserId: access.user_id, orgId: access.org_id, objectType: 'ath_business_profile',
      objectId: access.hub_profile_id, action: 'business_info_saved',
      before: { version: before.version, fields: before.fields, items: before.items, hours: before.hours },
      after: { version: nextVersion, fields: data.fields, services: data.services, serviceAreas: data.serviceAreas, languages: data.languages, hours: data.hours }, ctx: input.ctx });
    return { version: nextVersion, freshness: businessFreshness(now, this.now()) };
  }

  private async recordIssueEvent(input: { issueId:string; orgId:string; hubProfileId:string; actorUserId:string; actorKind:'user'|'staff'; eventType:string; fromStatus?:string|null; toStatus:string; message?:string|null; visibility?:'CUSTOMER'|'INTERNAL' }) {
    await this.deps.sql.query(`INSERT INTO ath_record_issue_events(issue_id,org_id,hub_profile_id,actor_user_id,actor_kind,event_type,from_status,to_status,message,visibility) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [input.issueId,input.orgId,input.hubProfileId,input.actorUserId,input.actorKind,input.eventType,input.fromStatus??null,input.toStatus,input.message??null,input.visibility??'CUSTOMER']);
  }

  async recordIssues(sessionToken:string,nativeProfileId:string) {
    const access=await this.requireProfileAccess(sessionToken,nativeProfileId);
    const issues=await this.deps.sql.query<Record<string,unknown>>(`SELECT id,issue_type,target_layer,target_record_type,target_record_id,explanation,status,version,customer_resolution_note,resolution_code,created_at::text,updated_at::text,resolved_at::text FROM ath_record_issues WHERE org_id=$1 AND hub_profile_id=$2 ORDER BY created_at DESC`,[access.org_id,access.hub_profile_id]);
    const ids=issues.rows.map((row)=>String(row.id));
    const events=ids.length ? await this.deps.sql.query<Record<string,unknown>>(`SELECT issue_id,event_type,from_status,to_status,message,created_at::text FROM ath_record_issue_events WHERE issue_id=ANY($1::uuid[]) AND visibility='CUSTOMER' ORDER BY created_at,id`,[ids]) : {rows:[] as Record<string,unknown>[]};
    return { issues:issues.rows.map((issue)=>({...issue,events:events.rows.filter((event)=>event.issue_id===issue.id)})), credentialKey:access.native_credential_key };
  }

  async createRecordIssue(input:{sessionToken:string;nativeProfileId:string;body:unknown;ctx?:RequestContext}) {
    const access=await this.requireProfileAccess(input.sessionToken,input.nativeProfileId,true); const data=validateRecordIssue(input.body);
    if(data.targetRecordType==='DBPR_CREDENTIAL'&&data.targetRecordId!==access.native_credential_key) throw new RecordIssueError('validation_failed');
    await this.hitRateLimit('record_issue_submit',`${access.user_id}:${access.hub_profile_id}`,5,60*60*1000).catch(()=>{throw new RecordIssueError('rate_limited')});
    const count=await one<{n:string}>(this.deps.sql,`SELECT COUNT(*)::text n FROM ath_record_issues WHERE org_id=$1 AND hub_profile_id=$2 AND status IN ('OPEN','UNDER_REVIEW','NEEDS_INFORMATION')`,[access.org_id,access.hub_profile_id]);
    if(Number(count?.n||0)>=10) throw new RecordIssueError('open_limit');
    const fingerprint=createHash('sha256').update([data.issueType,data.targetRecordType,data.targetRecordId||'',data.explanation.toLowerCase().replace(/\s+/g,' ')].join('|')).digest('hex');
    let issue;
    try { issue=await one<{id:string;created_at:string}>(this.deps.sql,`INSERT INTO ath_record_issues(org_id,hub_profile_id,submitted_by_user_id,issue_type,target_layer,target_record_type,target_record_id,explanation,submission_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,created_at::text`,[access.org_id,access.hub_profile_id,access.user_id,data.issueType,data.targetLayer,data.targetRecordType,data.targetRecordId,data.explanation,fingerprint]); }
    catch(error){if((error as {code?:string}).code==='23505') throw new RecordIssueError('duplicate'); throw error;}
    if(!issue) throw new RecordIssueError('validation_failed');
    await this.deps.sql.query(`INSERT INTO ath_review_queue(work_type,object_type,object_id,status,risk_state) VALUES('record_issue','ath_record_issues',$1,'open','standard')`,[issue.id]);
    await this.recordIssueEvent({issueId:issue.id,orgId:access.org_id,hubProfileId:access.hub_profile_id,actorUserId:access.user_id,actorKind:'user',eventType:'record_issue_created',toStatus:'OPEN'});
    await this.audit({actorUserId:access.user_id,orgId:access.org_id,objectType:'ath_record_issues',objectId:issue.id,action:'record_issue_created',after:{status:'OPEN',issue_type:data.issueType,target_record_type:data.targetRecordType,target_record_id:data.targetRecordId},ctx:input.ctx});
    const user=await one<{email:string}>(this.deps.sql,`SELECT email FROM ath_users WHERE id=$1`,[access.user_id]);
    if(user){const mail=recordIssueEmail({kind:'submitted',issueId:issue.id,profileName:access.display_name_snapshot||access.native_slug});await this.deps.mailer({to:user.email,...mail});}
    return {id:issue.id,status:'OPEN',createdAt:issue.created_at};
  }

  async customerRecordIssueAction(input:{sessionToken:string;nativeProfileId:string;issueId:string;action:'withdraw'|'respond';version:number;message?:string;ctx?:RequestContext}) {
    const access=await this.requireProfileAccess(input.sessionToken,input.nativeProfileId,true);
    const issue=await one<{id:string;status:RecordIssueStatus;version:number}>(this.deps.sql,`SELECT id,status,version FROM ath_record_issues WHERE id=$1 AND org_id=$2 AND hub_profile_id=$3 FOR UPDATE`,[input.issueId,access.org_id,access.hub_profile_id]);
    if(!issue) throw new RecordIssueError('not_found'); if(issue.version!==input.version) throw new RecordIssueError('stale_version');
    const next=input.action==='withdraw'?'WITHDRAWN':'OPEN'; if(!CUSTOMER_TRANSITIONS[issue.status]?.includes(next)) throw new RecordIssueError('invalid_transition');
    const message=String(input.message||'').trim(); if(input.action==='respond'&&(message.length<20||message.length>2000||/<\/?[a-z][\s\S]*>/i.test(message))) throw new RecordIssueError('validation_failed');
    const now=this.now().toISOString(); const updated=await this.deps.sql.query(`UPDATE ath_record_issues SET status=$4,version=version+1,resolved_at=CASE WHEN $4='WITHDRAWN' THEN $5::timestamptz ELSE NULL END,resolution_code=CASE WHEN $4='WITHDRAWN' THEN 'WITHDRAWN' ELSE NULL END WHERE id=$1 AND org_id=$2 AND hub_profile_id=$3 AND version=$6 RETURNING version`,[issue.id,access.org_id,access.hub_profile_id,next,now,input.version]);
    if(updated.rows.length===0) throw new RecordIssueError('stale_version');
    if(next==='WITHDRAWN') await this.deps.sql.query(`UPDATE ath_review_queue SET status='cancelled',resolved_at=$2 WHERE object_type='ath_record_issues' AND object_id=$1 AND status IN ('open','in_progress')`,[issue.id,now]);
    else await this.deps.sql.query(`UPDATE ath_review_queue SET status='open' WHERE object_type='ath_record_issues' AND object_id=$1`,[issue.id]);
    const eventType=input.action==='withdraw'?'record_issue_withdrawn':'record_issue_customer_response';
    await this.recordIssueEvent({issueId:issue.id,orgId:access.org_id,hubProfileId:access.hub_profile_id,actorUserId:access.user_id,actorKind:'user',eventType,fromStatus:issue.status,toStatus:next,message:message||null});
    await this.audit({actorUserId:access.user_id,orgId:access.org_id,objectType:'ath_record_issues',objectId:issue.id,action:eventType,before:{status:issue.status,version:issue.version},after:{status:next,version:issue.version+1},ctx:input.ctx});
    return {status:next,version:issue.version+1};
  }

  async listRecordIssueReviews(sessionToken:string,filter?:{issueType?:string;nativeProfileId?:string}) {
    await this.requireStaff(sessionToken);
    if(filter?.issueType&&!RECORD_ISSUE_TYPES.includes(filter.issueType as never)) throw new RecordIssueError('validation_failed');
    if(filter?.nativeProfileId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(filter.nativeProfileId)) throw new RecordIssueError('validation_failed');
    const result=await this.deps.sql.query<Record<string,unknown>>(`SELECT i.id,i.issue_type,i.status,i.target_record_type,i.created_at::text,p.native_profile_id::text,p.native_slug,p.native_credential_key,p.display_name_snapshot FROM ath_record_issues i JOIN ath_hub_profiles p ON p.id=i.hub_profile_id WHERE i.status IN ('OPEN','UNDER_REVIEW','NEEDS_INFORMATION') AND ($1::text IS NULL OR i.issue_type=$1) AND ($2::uuid IS NULL OR p.native_profile_id=$2::uuid) ORDER BY i.created_at`,[filter?.issueType||null,filter?.nativeProfileId||null]); return result.rows;
  }

  async getRecordIssueReview(sessionToken:string,issueId:string) {
    await this.requireStaff(sessionToken);
    const issue=await one<Record<string,unknown>>(this.deps.sql,`SELECT i.*,u.email claimant_email,o.display_name org_name,p.native_profile_id::text,p.native_slug,p.native_credential_key,p.native_source_system,p.home_state,p.display_name_snapshot FROM ath_record_issues i JOIN ath_users u ON u.id=i.submitted_by_user_id JOIN ath_organizations o ON o.id=i.org_id JOIN ath_hub_profiles p ON p.id=i.hub_profile_id WHERE i.id=$1`,[issueId]);
    if(!issue) throw new RecordIssueError('not_found');
    const events=await this.deps.sql.query<Record<string,unknown>>(`SELECT event_type,from_status,to_status,message,visibility,actor_kind,created_at::text FROM ath_record_issue_events WHERE issue_id=$1 ORDER BY created_at,id`,[issueId]);
    const remediation=await this.deps.sql.query<Record<string,unknown>>(`SELECT id,action_type,status,created_at::text,updated_at::text FROM ath_record_issue_remediation_tasks WHERE issue_id=$1 ORDER BY created_at`,[issueId]);
    return {issue,events:events.rows,remediation:remediation.rows,remediationPolicy:'No evidence mutation. RESOLVED_CORRECTED creates a separate authoritative ingest/reconciliation remediation task.'};
  }

  async staffTransitionRecordIssue(input:{sessionToken:string;issueId:string;nextStatus:RecordIssueStatus;version:number;customerNote?:string;internalNote?:string;ctx?:RequestContext}) {
    const staff=await this.requireStaff(input.sessionToken); await this.hitRateLimit('record_issue_review',staff.id,60,60*60*1000);
    const issue=await one<{id:string;org_id:string;hub_profile_id:string;submitted_by_user_id:string;status:RecordIssueStatus;version:number}>(this.deps.sql,`SELECT id,org_id,hub_profile_id,submitted_by_user_id,status,version FROM ath_record_issues WHERE id=$1 FOR UPDATE`,[input.issueId]);
    if(!issue) throw new RecordIssueError('not_found'); if(issue.version!==input.version) throw new RecordIssueError('stale_version'); if(!STAFF_TRANSITIONS[issue.status]?.includes(input.nextStatus)) throw new RecordIssueError('invalid_transition');
    const customerNote=String(input.customerNote||'').trim(),internalNote=String(input.internalNote||'').trim(); if(customerNote.length>2000||internalNote.length>4000||/<\/?[a-z][\s\S]*>/i.test(customerNote+internalNote)) throw new RecordIssueError('validation_failed');
    if(['NEEDS_INFORMATION','RESOLVED_CORRECTED','RESOLVED_NO_CHANGE','RESOLVED_SOURCE_PENDING','REJECTED'].includes(input.nextStatus)&&customerNote.length<10) throw new RecordIssueError('validation_failed');
    const eventMap:Record<string,string>={UNDER_REVIEW:'record_issue_under_review',NEEDS_INFORMATION:'record_issue_more_info_requested',RESOLVED_CORRECTED:'record_issue_resolved_corrected',RESOLVED_NO_CHANGE:'record_issue_resolved_no_change',RESOLVED_SOURCE_PENDING:'record_issue_source_pending',REJECTED:'record_issue_rejected'};
    const codeMap:Record<string,string>={RESOLVED_CORRECTED:'CORRECTED',RESOLVED_NO_CHANGE:'NO_CHANGE',RESOLVED_SOURCE_PENDING:'SOURCE_PENDING',REJECTED:'INVALID'}; const terminal=Boolean(codeMap[input.nextStatus]); const now=this.now().toISOString();
    const updated=await this.deps.sql.query(`UPDATE ath_record_issues SET status=$2,version=version+1,customer_resolution_note=NULLIF($3,''),internal_resolution_note=NULLIF($4,''),resolved_at=CASE WHEN $5 THEN $6::timestamptz ELSE NULL END,resolved_by=CASE WHEN $5 THEN $7::uuid ELSE NULL END,resolution_code=$8 WHERE id=$1 AND version=$9 RETURNING version`,[issue.id,input.nextStatus,customerNote,internalNote,terminal,now,staff.id,codeMap[input.nextStatus]||null,input.version]); if(updated.rows.length===0) throw new RecordIssueError('stale_version');
    await this.deps.sql.query(`UPDATE ath_review_queue SET status=$2,resolved_at=CASE WHEN $2='resolved' THEN $3::timestamptz ELSE NULL END WHERE object_type='ath_record_issues' AND object_id=$1`,[issue.id,terminal?'resolved':'in_progress',now]);
    if(input.nextStatus==='RESOLVED_CORRECTED') await this.deps.sql.query(`INSERT INTO ath_record_issue_remediation_tasks(issue_id,created_by) VALUES($1,$2) ON CONFLICT(issue_id,action_type) DO NOTHING`,[issue.id,staff.id]);
    const eventType=eventMap[input.nextStatus]; await this.recordIssueEvent({issueId:issue.id,orgId:issue.org_id,hubProfileId:issue.hub_profile_id,actorUserId:staff.id,actorKind:'staff',eventType,fromStatus:issue.status,toStatus:input.nextStatus,message:customerNote||null});
    if(internalNote) await this.recordIssueEvent({issueId:issue.id,orgId:issue.org_id,hubProfileId:issue.hub_profile_id,actorUserId:staff.id,actorKind:'staff',eventType,fromStatus:issue.status,toStatus:input.nextStatus,message:internalNote,visibility:'INTERNAL'});
    await this.audit({actorUserId:staff.id,actorKind:'staff',orgId:issue.org_id,objectType:'ath_record_issues',objectId:issue.id,action:eventType,before:{status:issue.status,version:issue.version},after:{status:input.nextStatus,version:issue.version+1,resolution_code:codeMap[input.nextStatus]||null},ctx:input.ctx});
    if(input.nextStatus==='NEEDS_INFORMATION'||terminal){const recipient=await one<{email:string;display_name_snapshot:string}>(this.deps.sql,`SELECT u.email,p.display_name_snapshot FROM ath_users u,ath_hub_profiles p WHERE u.id=$1 AND p.id=$2`,[issue.submitted_by_user_id,issue.hub_profile_id]);if(recipient){const mail=recordIssueEmail({kind:input.nextStatus==='NEEDS_INFORMATION'?'needs_info':'resolved',issueId:issue.id,profileName:recipient.display_name_snapshot,note:customerNote});await this.deps.mailer({to:recipient.email,...mail});}}
    return {status:input.nextStatus,version:issue.version+1};
  }

  private async businessReplyEvent(input:{replyId:string;orgId:string;hubProfileId:string;actorUserId?:string|null;actorKind:'user'|'staff'|'system';eventType:string;revisionId?:string|null;fromStatus?:string|null;toStatus:string;message?:string|null;visibility?:'CUSTOMER'|'INTERNAL'}){
    await this.deps.sql.query(`INSERT INTO ath_business_reply_events(reply_id,org_id,hub_profile_id,actor_user_id,actor_kind,event_type,revision_id,from_status,to_status,message,visibility) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[input.replyId,input.orgId,input.hubProfileId,input.actorUserId||null,input.actorKind,input.eventType,input.revisionId||null,input.fromStatus||null,input.toStatus,input.message||null,input.visibility||'CUSTOMER']);
  }

  async businessReplies(sessionToken:string,nativeProfileId:string){const access=await this.requireProfileAccess(sessionToken,nativeProfileId);const replies=await this.deps.sql.query<Record<string,unknown>>(`SELECT r.id,r.reply_type,r.target_type,r.target_record_id,r.status,r.version,r.published_at::text,r.created_at::text,v.id revision_id,v.revision_number,v.body,v.moderation_status FROM ath_business_replies r JOIN ath_business_reply_revisions v ON v.id=r.active_revision_id WHERE r.org_id=$1 AND r.hub_profile_id=$2 ORDER BY r.created_at DESC`,[access.org_id,access.hub_profile_id]);const ids=replies.rows.map(r=>r.id);const events=ids.length?await this.deps.sql.query<Record<string,unknown>>(`SELECT reply_id,event_type,message,created_at::text FROM ath_business_reply_events WHERE reply_id=ANY($1::uuid[]) AND visibility='CUSTOMER' ORDER BY created_at,id`,[ids]):{rows:[] as Record<string,unknown>[]};return{access,replies:replies.rows.map(r=>({...r,events:events.rows.filter(e=>e.reply_id===r.id)}))}}

  async createBusinessReply(input:{sessionToken:string;nativeProfileId:string;body:unknown;ctx?:RequestContext}){const access=await this.requireProfileAccess(input.sessionToken,input.nativeProfileId,true);const data=validateBusinessReply(input.body);await this.hitRateLimit('business_reply_write',`${access.user_id}:${access.hub_profile_id}`,10,60*60*1000);try{const reply=await one<{id:string;created_at:string}>(this.deps.sql,`INSERT INTO ath_business_replies(org_id,hub_profile_id,submitted_by_user_id,reply_type,target_type,target_record_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,created_at::text`,[access.org_id,access.hub_profile_id,access.user_id,data.replyType,data.targetType,data.targetRecordId]);if(!reply)throw new BusinessReplyError('validation_failed');const revision=await one<{id:string}>(this.deps.sql,`INSERT INTO ath_business_reply_revisions(reply_id,revision_number,body,created_by_user_id,moderation_status) VALUES($1,1,$2,$3,'DRAFT') RETURNING id`,[reply.id,data.body,access.user_id]);await this.deps.sql.query(`UPDATE ath_business_replies SET active_revision_id=$2 WHERE id=$1`,[reply.id,revision!.id]);await this.businessReplyEvent({replyId:reply.id,orgId:access.org_id,hubProfileId:access.hub_profile_id,actorUserId:access.user_id,actorKind:'user',eventType:'business_reply_draft_created',revisionId:revision!.id,toStatus:'DRAFT'});await this.audit({actorUserId:access.user_id,orgId:access.org_id,objectType:'ath_business_replies',objectId:reply.id,action:'business_reply_draft_created',after:{target_type:data.targetType,reply_type:data.replyType},ctx:input.ctx});return{id:reply.id,status:'DRAFT',version:1}}catch(error){if(/duplicate key/i.test(String(error)))throw new BusinessReplyError('duplicate');throw error}}

  async customerBusinessReplyAction(input:{sessionToken:string;nativeProfileId:string;replyId:string;action:'update'|'submit'|'withdraw'|'respond'|'revise';version:number;body?:unknown;message?:string;ctx?:RequestContext}){const access=await this.requireProfileAccess(input.sessionToken,input.nativeProfileId,true);const reply=await one<{id:string;status:BusinessReplyStatus;version:number;active_revision_id:string;published_revision_id:string|null;reply_type:string;target_type:string;target_record_id:string|null}>(this.deps.sql,`SELECT id,status,version,active_revision_id,published_revision_id,reply_type,target_type,target_record_id FROM ath_business_replies WHERE id=$1 AND org_id=$2 AND hub_profile_id=$3 FOR UPDATE`,[input.replyId,access.org_id,access.hub_profile_id]);if(!reply)throw new BusinessReplyError('not_found');if(reply.version!==input.version)throw new BusinessReplyError('stale_version');const now=this.now().toISOString();let next=reply.status,event='business_reply_updated',revisionId=reply.active_revision_id;
    if(input.action==='update'){if(reply.status!=='DRAFT')throw new BusinessReplyError('invalid_transition');const data=validateBusinessReply({...(input.body as object),replyType:reply.reply_type,targetType:reply.target_type,targetRecordId:reply.target_record_id});await this.deps.sql.query(`UPDATE ath_business_reply_revisions SET body=$2 WHERE id=$1 AND moderation_status='DRAFT'`,[revisionId,data.body]);}
    else if(input.action==='revise'){if(reply.status!=='APPROVED')throw new BusinessReplyError('invalid_transition');const data=validateBusinessReply({...(input.body as object),replyType:reply.reply_type,targetType:reply.target_type,targetRecordId:reply.target_record_id});const rev=await one<{id:string}>(this.deps.sql,`INSERT INTO ath_business_reply_revisions(reply_id,revision_number,body,created_by_user_id,moderation_status) SELECT $1,COALESCE(MAX(revision_number),0)+1,$2,$3,'DRAFT' FROM ath_business_reply_revisions WHERE reply_id=$1 RETURNING id`,[reply.id,data.body,access.user_id]);revisionId=rev!.id;next='DRAFT';event='business_reply_revision_created';}
    else if(input.action==='submit'){if(reply.status!=='DRAFT')throw new BusinessReplyError('invalid_transition');next='SUBMITTED';event='business_reply_submitted';await this.deps.sql.query(`UPDATE ath_business_reply_revisions SET moderation_status='SUBMITTED',submitted_at=$2 WHERE id=$1`,[revisionId,now]);await this.deps.sql.query(`INSERT INTO ath_review_queue(work_type,object_type,object_id,status,risk_state) VALUES('business_reply','ath_business_replies',$1,'open','standard')`,[reply.id]);}
    else if(input.action==='respond'){if(reply.status!=='NEEDS_INFORMATION')throw new BusinessReplyError('invalid_transition');const message=String(input.message||'').trim();if(message.length<20||message.length>2000||/<\/?[a-z][\s\S]*>/i.test(message))throw new BusinessReplyError('validation_failed');next='SUBMITTED';event='business_reply_customer_response';await this.businessReplyEvent({replyId:reply.id,orgId:access.org_id,hubProfileId:access.hub_profile_id,actorUserId:access.user_id,actorKind:'user',eventType:event,revisionId,fromStatus:reply.status,toStatus:next,message});}
    else {if(!['DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_INFORMATION','APPROVED'].includes(reply.status))throw new BusinessReplyError('invalid_transition');next='WITHDRAWN';event='business_reply_withdrawn';await this.deps.sql.query(`UPDATE ath_business_reply_revisions SET moderation_status='WITHDRAWN' WHERE id=$1 AND moderation_status<>'APPROVED'`,[revisionId]);}
    const updated=await this.deps.sql.query(`UPDATE ath_business_replies SET status=$2,version=version+1,active_revision_id=$3,submitted_at=CASE WHEN $2='SUBMITTED' THEN $4::timestamptz ELSE submitted_at END,withdrawn_at=CASE WHEN $2='WITHDRAWN' THEN $4::timestamptz ELSE NULL END,published_revision_id=CASE WHEN $2='WITHDRAWN' THEN NULL ELSE published_revision_id END WHERE id=$1 AND version=$5 RETURNING version`,[reply.id,next,revisionId,now,input.version]);if(!updated.rows.length)throw new BusinessReplyError('stale_version');if(input.action!=='respond')await this.businessReplyEvent({replyId:reply.id,orgId:access.org_id,hubProfileId:access.hub_profile_id,actorUserId:access.user_id,actorKind:'user',eventType:event,revisionId,fromStatus:reply.status,toStatus:next});await this.audit({actorUserId:access.user_id,orgId:access.org_id,objectType:'ath_business_replies',objectId:reply.id,action:event,before:{status:reply.status,version:reply.version},after:{status:next,version:reply.version+1},ctx:input.ctx});return{status:next,version:reply.version+1};}

  async listBusinessReplyReviews(sessionToken:string){await this.requireStaff(sessionToken);return(await this.deps.sql.query<Record<string,unknown>>(`SELECT r.id,r.reply_type,r.target_type,r.status,r.created_at::text,p.native_profile_id::text,p.native_credential_key,p.display_name_snapshot FROM ath_business_replies r JOIN ath_hub_profiles p ON p.id=r.hub_profile_id WHERE r.status IN ('SUBMITTED','UNDER_REVIEW','NEEDS_INFORMATION') ORDER BY r.created_at`)).rows}
  async getBusinessReplyReview(sessionToken:string,id:string){await this.requireStaff(sessionToken);const reply=await one<Record<string,unknown>>(this.deps.sql,`SELECT r.*,v.body,v.revision_number,o.display_name org_name,p.native_profile_id::text,p.native_slug,p.native_credential_key,p.native_source_system,p.display_name_snapshot FROM ath_business_replies r JOIN ath_business_reply_revisions v ON v.id=r.active_revision_id JOIN ath_organizations o ON o.id=r.org_id JOIN ath_hub_profiles p ON p.id=r.hub_profile_id WHERE r.id=$1`,[id]);if(!reply)throw new BusinessReplyError('not_found');const events=await this.deps.sql.query<Record<string,unknown>>(`SELECT event_type,message,visibility,created_at::text FROM ath_business_reply_events WHERE reply_id=$1 ORDER BY created_at,id`,[id]);return{reply,events:events.rows}}
  async staffTransitionBusinessReply(input:{sessionToken:string;replyId:string;nextStatus:BusinessReplyStatus;version:number;customerNote?:string;internalNote?:string;ctx?:RequestContext}){const staff=await this.requireStaff(input.sessionToken);if(!BUSINESS_REPLY_STATUSES.includes(input.nextStatus)||!['UNDER_REVIEW','NEEDS_INFORMATION','APPROVED','REJECTED','ARCHIVED'].includes(input.nextStatus))throw new BusinessReplyError('invalid_transition');const reply=await one<{id:string;org_id:string;hub_profile_id:string;submitted_by_user_id:string;status:BusinessReplyStatus;version:number;active_revision_id:string}>(this.deps.sql,`SELECT id,org_id,hub_profile_id,submitted_by_user_id,status,version,active_revision_id FROM ath_business_replies WHERE id=$1 FOR UPDATE`,[input.replyId]);if(!reply)throw new BusinessReplyError('not_found');if(reply.version!==input.version||!STAFF_REPLY_TRANSITIONS[reply.status]?.includes(input.nextStatus))throw new BusinessReplyError(reply.version!==input.version?'stale_version':'invalid_transition');const customerNote=String(input.customerNote||'').trim(),internalNote=String(input.internalNote||'').trim();if((['NEEDS_INFORMATION','REJECTED'].includes(input.nextStatus)&&customerNote.length<10)||customerNote.length>2000||internalNote.length>4000||/<\/?[a-z][\s\S]*>/i.test(customerNote+internalNote))throw new BusinessReplyError('validation_failed');if(input.nextStatus==='APPROVED'){const authority=await one(this.deps.sql,`SELECT 1 FROM ath_management_grants g JOIN ath_memberships m ON m.org_id=g.org_id AND m.status='active' AND m.role IN ('owner','manager','staff') WHERE g.org_id=$1 AND g.hub_profile_id=$2 AND g.status='active'`,[reply.org_id,reply.hub_profile_id]);if(!authority)throw new BusinessReplyError('forbidden');}const now=this.now().toISOString(),eventMap:Record<string,string>={UNDER_REVIEW:'business_reply_updated',NEEDS_INFORMATION:'business_reply_changes_requested',APPROVED:'business_reply_approved',REJECTED:'business_reply_rejected',ARCHIVED:'business_reply_archived'},approved=input.nextStatus==='APPROVED';await this.deps.sql.query(`UPDATE ath_business_reply_revisions SET moderation_status=$2,approved_at=CASE WHEN $3 THEN $4::timestamptz ELSE approved_at END WHERE id=$1`,[reply.active_revision_id,input.nextStatus,approved,now]);await this.deps.sql.query(`UPDATE ath_business_replies SET status=$2,version=version+1,customer_note=NULLIF($3,''),internal_note=NULLIF($4,''),reviewed_at=$5,published_revision_id=CASE WHEN $6 THEN active_revision_id ELSE published_revision_id END,published_at=CASE WHEN $6 THEN $5::timestamptz ELSE published_at END WHERE id=$1 AND version=$7`,[reply.id,input.nextStatus,customerNote,internalNote,now,approved,input.version]);await this.businessReplyEvent({replyId:reply.id,orgId:reply.org_id,hubProfileId:reply.hub_profile_id,actorUserId:staff.id,actorKind:'staff',eventType:eventMap[input.nextStatus],revisionId:reply.active_revision_id,fromStatus:reply.status,toStatus:input.nextStatus,message:customerNote||null});if(internalNote)await this.businessReplyEvent({replyId:reply.id,orgId:reply.org_id,hubProfileId:reply.hub_profile_id,actorUserId:staff.id,actorKind:'staff',eventType:eventMap[input.nextStatus],revisionId:reply.active_revision_id,fromStatus:reply.status,toStatus:input.nextStatus,message:internalNote,visibility:'INTERNAL'});await this.audit({actorUserId:staff.id,actorKind:'staff',orgId:reply.org_id,objectType:'ath_business_replies',objectId:reply.id,action:eventMap[input.nextStatus],before:{status:reply.status},after:{status:input.nextStatus},ctx:input.ctx});const recipient=await one<{email:string;display_name_snapshot:string}>(this.deps.sql,`SELECT u.email,p.display_name_snapshot FROM ath_users u,ath_hub_profiles p WHERE u.id=$1 AND p.id=$2`,[reply.submitted_by_user_id,reply.hub_profile_id]);if(recipient&&['NEEDS_INFORMATION','APPROVED','REJECTED'].includes(input.nextStatus)){const kind=input.nextStatus==='NEEDS_INFORMATION'?'changes':input.nextStatus==='APPROVED'?'approved':'rejected';await this.deps.mailer({to:recipient.email,...businessReplyEmail({kind,replyId:reply.id,profileName:recipient.display_name_snapshot,note:customerNote})})}return{status:input.nextStatus,version:reply.version+1}}

  async publicBusinessReplies(nativeProfileId:string):Promise<PublicBusinessReplies>{const rows=await this.deps.sql.query<{id:string;reply_type:string;target_type:string;target_record_id:string|null;body:string;published_at:string;created_at:string;revision_number:number}>(`SELECT r.id,r.reply_type,r.target_type,r.target_record_id,v.body,r.published_at::text,v.created_at::text,v.revision_number FROM ath_business_replies r JOIN ath_hub_profiles p ON p.id=r.hub_profile_id AND p.hub_id='contractor' JOIN ath_business_reply_revisions v ON v.id=r.published_revision_id AND v.moderation_status='APPROVED' WHERE p.native_profile_id=$1::uuid AND r.published_revision_id IS NOT NULL AND r.withdrawn_at IS NULL ORDER BY r.published_at`,[nativeProfileId]);return{contractVersion:1,hub:'contractor',nativeProfileId,replies:rows.rows.map(r=>({id:r.id,replyType:r.reply_type,targetType:r.target_type,targetRecordId:r.target_record_id,body:r.body,source:'BUSINESS_RESPONSE',publishedAt:r.published_at,updatedAt:r.revision_number>1?r.created_at:null}))}}

  async managedHome(sessionToken: string) {
    const user = await this.sessionUser(sessionToken);
    if (!user) throw new AuthError('missing_session');
    const res = await this.deps.sql.query(
      `SELECT g.id AS grant_id, g.status AS grant_status, g.granted_at,
              o.id AS org_id, o.display_name,
              p.id AS hub_profile_id, p.native_slug, p.native_credential_key, p.native_profile_id, p.display_name_snapshot,
              m.role, c.id AS claim_id, c.status AS claim_status
         FROM ath_management_grants g
         JOIN ath_organizations o ON o.id = g.org_id
         JOIN ath_hub_profiles p ON p.id = g.hub_profile_id
         JOIN ath_memberships m ON m.org_id = o.id AND m.user_id = $1 AND m.status = 'active'
         JOIN ath_claims c ON c.id = g.granted_from_claim_id
        WHERE g.status = 'active'
        ORDER BY g.granted_at DESC`,
      [user.id]
    );
    return res.rows;
  }
}

export function parseStaffEmails(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
