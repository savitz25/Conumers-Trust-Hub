import { loadAndValidateProfile, type CthDirectory } from './adapter.ts';
import { hashToken, isEmailShape, normalizeEmail, randomToken } from './crypto.ts';
import {
  approvedEmail,
  claimReceivedEmail,
  loginEmail,
  needsInfoEmail,
  rejectedEmail,
} from './copy.ts';
import { isFreeEmail } from './free-email.ts';
import { HandoffError, parseAndAuthenticateHandoff } from './handoff.ts';
import { customerLog } from './log.ts';
import type { Mailer } from './mail.ts';
import { one, type SqlClient } from './sql.ts';
import { validateBusinessProfile, type BusinessProfileInput } from './business-profile.ts';
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
    const items = await this.deps.sql.query<{ category: string; value_text: string; position: number; supplied_by_user_id: string; first_supplied_at: string; updated_at: string; source: string }>(
        `SELECT category,value_text,position,supplied_by_user_id,first_supplied_at::text,updated_at::text,source
           FROM ath_business_profile_items WHERE org_id=$1 AND hub_profile_id=$2 ORDER BY category,position`,
        [access.org_id, access.hub_profile_id]);
    const hours = await this.deps.sql.query<{ weekday: number; is_closed: boolean; opens_at: string | null; closes_at: string | null; supplied_by_user_id: string; first_supplied_at: string; updated_at: string; source: string }>(
        `SELECT weekday,is_closed,opens_at::text,closes_at::text,supplied_by_user_id,first_supplied_at::text,updated_at::text,source
           FROM ath_business_profile_hours WHERE org_id=$1 AND hub_profile_id=$2 ORDER BY weekday`,
        [access.org_id, access.hub_profile_id]);
    const activity = await this.deps.sql.query<{ action: string; created_at: string; actor_user_id: string | null }>(
        `SELECT action,created_at::text,actor_user_id FROM ath_audit_events
          WHERE org_id=$1 AND object_type='ath_business_profile' AND object_id=$2
          ORDER BY created_at DESC LIMIT 10`, [access.org_id, access.hub_profile_id]);
    return { access, version: revision?.version ?? 0, fields: fields.rows, items: items.rows, hours: hours.rows, activity: activity.rows };
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
    return { version: nextVersion };
  }

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
