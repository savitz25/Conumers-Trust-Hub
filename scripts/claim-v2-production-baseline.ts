/**
 * ATH-CLAIM-V2-001 — Section 2: current production baseline (READ ONLY).
 *
 * Run:  node --experimental-strip-types --env-file=.env.local scripts/claim-v2-production-baseline.ts
 *
 * Guarantees:
 *  - One pg client, `BEGIN READ ONLY`, `SET LOCAL statement_timeout`, every query inside a SAVEPOINT,
 *    and an unconditional `ROLLBACK`. Zero writes, zero DDL.
 *  - Prints counts, dates, and low-cardinality classifications only. It never prints an email address,
 *    a legal/organization name, a public profile name, an IP address, a user agent, a token, or the
 *    connection string. Claim IDs are opaque UUIDs so the Founder can open a case in
 *    /admin/operations/claims/<id>.
 *  - Classification for open claims is INTERNAL_TEST_CONFIRMED / LIKELY_INTERNAL_TEST /
 *    POTENTIAL_REAL_CLAIM / REAL_CLAIM_CONFIRMED / UNKNOWN. REAL_CLAIM_CONFIRMED is never produced by
 *    this script; only a human can confirm a real claim. Email domain alone is never a classifier.
 */
import { Client } from 'pg';
import { selectAskDatabaseUrl } from '../lib/customer/database-selection.ts';
import { normalizeEmail } from '../lib/customer/crypto.ts';

type Row = Record<string, unknown>;
const SYNTHETIC_NAME = /\b(test|qa|sample|demo|fixture|synthetic|harbor test)\b/i;

function staffSet(): Set<string> {
  return new Set(
    [process.env.ATH_STAFF_EMAILS, process.env.ATH_STAFF_EMAILS_EXTRA, process.env.ATH_LIFECYCLE_QA_OPERATOR_EMAIL, process.env.ATH_LIFECYCLE_QA_EMAIL]
      .flatMap((raw) => (raw || '').split(','))
      .map((s) => normalizeEmail(s.trim()))
      .filter(Boolean),
  );
}

async function main() {
  const url = selectAskDatabaseUrl(process.env);
  if (!url) throw new Error('Ask customer database is not configured (neon_tech_database / ASK_DATABASE_URL).');
  const client = new Client({ connectionString: url, ssl: /neon|supabase|sslmode=require|pooler/i.test(url) ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  const out: Record<string, unknown> = { generated_at: new Date().toISOString(), mode: 'READ ONLY' };
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '20000'");
    await client.query("SELECT set_config('ath.app_role','server',true)");
    const q = async <T extends Row = Row>(label: string, sql: string, params: unknown[] = []): Promise<T[] | null> => {
      await client.query('SAVEPOINT q');
      try {
        const r = await client.query(sql, params);
        await client.query('RELEASE SAVEPOINT q');
        return r.rows as T[];
      } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT q');
        out[`${label}_error`] = error instanceof Error ? error.message.slice(0, 120) : 'error';
        return null;
      }
    };
    const count = async (label: string, sql: string) => {
      const rows = await q<{ n: string }>(label, `SELECT count(*)::text AS n FROM ${sql}`);
      return rows ? Number(rows[0]?.n ?? 0) : null;
    };

    out.summary = {
      users: await count('users', 'ath_users'),
      organizations: await count('organizations', 'ath_organizations'),
      hub_profiles: await count('hub_profiles', 'ath_hub_profiles'),
      claims_total: await count('claims', 'ath_claims'),
      claims_approved: await count('claims_approved', `ath_claims WHERE status='approved'`),
      claims_submitted: await count('claims_submitted', `ath_claims WHERE status='submitted'`),
      claims_needs_info: await count('claims_needs_info', `ath_claims WHERE status='needs_info'`),
      claims_in_review: await count('claims_in_review', `ath_claims WHERE status='in_review'`),
      claims_rejected: await count('claims_rejected', `ath_claims WHERE status='rejected'`),
      claims_withdrawn_or_superseded: await count('claims_wd', `ath_claims WHERE status IN ('withdrawn','superseded')`),
      grants_total: await count('grants', 'ath_management_grants'),
      grants_active: await count('grants_active', `ath_management_grants WHERE status='active'`),
      grants_revoked: await count('grants_revoked', `ath_management_grants WHERE status='revoked'`),
      grants_contested: await count('grants_contested', `ath_management_grants WHERE status='contested'`),
      business_profiles_with_supplied_fields: await count('bp_fields', '(SELECT DISTINCT org_id,hub_profile_id FROM ath_business_profile_fields) x'),
      business_profile_revisions: await count('bp_rev', 'ath_business_profile_revisions'),
      business_responses_total: await count('replies', 'ath_business_replies'),
      business_responses_published: await count('replies_pub', `ath_business_replies WHERE published_revision_id IS NOT NULL AND withdrawn_at IS NULL`),
      monitoring_subscriptions: await count('monitoring', 'ath_monitoring_subscriptions'),
      monitoring_enabled: await count('monitoring_on', 'ath_monitoring_subscriptions WHERE enabled'),
      record_issues_total: await count('issues', 'ath_record_issues'),
      claim_intents_total: await count('intents', 'ath_claim_intents'),
      claim_intents_consumed: await count('intents_consumed', 'ath_claim_intents WHERE consumed_at IS NOT NULL'),
      claim_intents_last_7d: await count('intents_7d', `ath_claim_intents WHERE created_at >= now()-interval '7 days'`),
      claim_intents_last_30d: await count('intents_30d', `ath_claim_intents WHERE created_at >= now()-interval '30 days'`),
      review_queue_open_claims: await count('rq', `ath_review_queue WHERE object_type='ath_claims' AND status IN ('open','in_progress')`),
      ops_cases_open: await count('ops', `ath_ops_cases WHERE status IN ('OPEN','IN_PROGRESS','WAITING')`),
      claim_attribution_rows: await count('attr', 'ath_claim_attribution'),
      rate_events_last_7d: await count('rate', `ath_rate_events WHERE created_at >= now()-interval '7 days'`),
    };

    out.claims_by_hub_status = await q('by_hub', `SELECT p.hub_id AS hub, c.status, count(*)::int AS n FROM ath_claims c JOIN ath_hub_profiles p ON p.id=c.hub_profile_id GROUP BY 1,2 ORDER BY 1,2`);
    out.claim_intents_by_hub = await q('intents_by_hub', `SELECT COALESCE(payload->>'hub_id','unknown') AS hub, count(*)::int AS n, count(consumed_at)::int AS consumed, min(created_at)::date::text AS first_seen, max(created_at)::date::text AS last_seen FROM ath_claim_intents GROUP BY 1 ORDER BY 2 DESC`);
    out.claim_intents_by_month = await q('intents_by_month', `SELECT to_char(created_at,'YYYY-MM') AS month, count(*)::int AS n, count(consumed_at)::int AS consumed FROM ath_claim_intents GROUP BY 1 ORDER BY 1`);
    out.claim_intents_top_days = await q('intents_top_days', `SELECT created_at::date::text AS day, count(*)::int AS n FROM ath_claim_intents GROUP BY 1 ORDER BY 2 DESC LIMIT 7`);
    out.claim_intents_distinct_profiles = await q('intents_profiles', `SELECT count(DISTINCT payload->>'native_profile_id')::int AS distinct_profiles, count(DISTINCT payload->>'nonce')::int AS distinct_nonces FROM ath_claim_intents`);
    out.approved_history = await q('approved_history', `SELECT c.id::text AS claim_id, p.hub_id AS hub, c.created_at::date::text AS submitted_on, c.reviewed_at::date::text AS decided_on, g.status AS grant_status, g.revoked_at::date::text AS revoked_on FROM ath_claims c JOIN ath_hub_profiles p ON p.id=c.hub_profile_id LEFT JOIN ath_management_grants g ON g.granted_from_claim_id=c.id WHERE c.status='approved' ORDER BY c.created_at`);
    out.product_claim_events_30d = await q('product_events', `SELECT event_name, count(*)::int AS n FROM ath_product_events WHERE occurred_at >= now()-interval '30 days' AND event_name LIKE 'claim_%' GROUP BY 1 ORDER BY 2 DESC`);

    const staff = staffSet();
    const open = await q('open_claims', `SELECT c.id::text AS claim_id, c.status, c.created_at::date::text AS submitted_on, round(extract(epoch FROM (now()-c.created_at))/3600)::int AS age_hours,
        c.free_email, c.relationship_type, c.verification_method, p.hub_id AS hub, COALESCE(p.entity_class,'contractor') AS entity_class, p.home_state, p.display_name_snapshot, o.display_name AS org_name,
        u.email, (u.email_confirmed_at IS NOT NULL) AS email_confirmed, u.created_at::date::text AS account_created_on,
        c.attestation->>'acquisition_source' AS attested_source, c.attestation->>'competing' AS competing, c.attestation->>'document_upload' AS document_upload,
        (SELECT count(*)::int FROM ath_claims x WHERE x.claimant_user_id=c.claimant_user_id AND x.id<>c.id) AS other_claims_same_user,
        (SELECT count(*)::int FROM ath_claims x WHERE x.hub_profile_id=c.hub_profile_id AND x.id<>c.id) AS other_claims_same_profile,
        (SELECT count(*)::int FROM ath_management_grants g JOIN ath_claims pc ON pc.id=g.granted_from_claim_id WHERE pc.claimant_user_id=c.claimant_user_id) AS grants_ever_for_user,
        (SELECT count(*)::int FROM ath_management_grants g WHERE g.hub_profile_id=c.hub_profile_id AND g.status='active') AS active_grant_on_profile,
        (SELECT string_agg(a.action||'@'||to_char(a.created_at,'YYYY-MM-DD'),' | ' ORDER BY a.created_at) FROM ath_audit_events a WHERE a.object_type='ath_claims' AND a.object_id=c.id) AS audit_trail,
        (SELECT count(DISTINCT a.ip)::int FROM ath_audit_events a WHERE a.actor_user_id=c.claimant_user_id AND a.ip IS NOT NULL) AS distinct_ips,
        COALESCE((SELECT bool_or(EXISTS(SELECT 1 FROM ath_audit_events s WHERE s.actor_kind='staff' AND s.ip=a.ip)) FROM ath_audit_events a WHERE a.actor_user_id=c.claimant_user_id AND a.ip IS NOT NULL),false) AS shares_ip_with_staff,
        (SELECT count(*)::int FROM ath_record_issues ri WHERE ri.org_id=c.org_id) AS record_issues_by_org,
        (SELECT count(*)::int FROM ath_business_profile_fields f WHERE f.org_id=c.org_id) AS supplied_fields_by_org
      FROM ath_claims c JOIN ath_hub_profiles p ON p.id=c.hub_profile_id JOIN ath_users u ON u.id=c.claimant_user_id JOIN ath_organizations o ON o.id=c.org_id
      WHERE c.status IN ('submitted','needs_info','in_review') ORDER BY c.created_at`);
    const attribution = await q<{ claim_id: string; acquisition_source: string }>('attribution', `SELECT claim_id::text, acquisition_source FROM ath_claim_attribution`);
    const attributionByClaim = new Map((attribution ?? []).map((r) => [r.claim_id, r.acquisition_source]));

    out.open_claims = (open ?? []).map((r) => {
      const email = normalizeEmail(String(r.email ?? ''));
      const isStaffEmail = staff.has(email);
      const emailLocal = email.split('@')[0] ?? '';
      const localMarker = /\+(?:qa|test|proof|canary)|^(?:qa|test|proof|canary)[-._]?/i.test(emailLocal);
      const nameMarker = SYNTHETIC_NAME.test(String(r.display_name_snapshot ?? '')) || SYNTHETIC_NAME.test(String(r.org_name ?? ''));
      const attestedSource = String(r.attested_source ?? '');
      const attributionSource = attributionByClaim.get(String(r.claim_id)) ?? null;
      const reasons: string[] = [];
      let classification: 'INTERNAL_TEST_CONFIRMED' | 'LIKELY_INTERNAL_TEST' | 'POTENTIAL_REAL_CLAIM' | 'UNKNOWN' = 'UNKNOWN';
      if (isStaffEmail) reasons.push('claimant account is a configured staff/QA operator account');
      if (attestedSource === 'internal_test' || attributionSource === 'INTERNAL_TEST') reasons.push('claim is labelled internal_test');
      if (nameMarker) reasons.push('profile or organization name carries a synthetic fixture marker');
      if (isStaffEmail || attestedSource === 'internal_test' || attributionSource === 'INTERNAL_TEST' || nameMarker) classification = 'INTERNAL_TEST_CONFIRMED';
      else {
        if (Number(r.grants_ever_for_user) > 0) reasons.push('same claimant previously held a grant that was part of the historical proof/QA cohort');
        if (r.shares_ip_with_staff === true) reasons.push('claimant network address also appears on staff audit events');
        if (localMarker) reasons.push('claimant address local-part uses a qa/test/proof tag');
        if (reasons.length >= 1) classification = 'LIKELY_INTERNAL_TEST';
        else {
          reasons.push('no internal-test marker found in audit history, metadata, attribution, or surrounding records');
          classification = 'POTENTIAL_REAL_CLAIM';
        }
      }
      return {
        claim_id: r.claim_id,
        status: r.status,
        submitted_on: r.submitted_on,
        age_hours: r.age_hours,
        age_days: Math.round(Number(r.age_hours) / 24),
        hub: r.hub,
        entity_class: r.entity_class,
        home_state: r.home_state,
        relationship_type: r.relationship_type,
        verification_method: r.verification_method,
        free_email_flag: r.free_email,
        email_confirmed: r.email_confirmed,
        account_created_on: r.account_created_on,
        attested_source: attestedSource || null,
        attribution_source: attributionSource,
        competing_at_submission: r.competing,
        document_upload: r.document_upload,
        other_claims_same_user: r.other_claims_same_user,
        other_claims_same_profile: r.other_claims_same_profile,
        grants_ever_for_user: r.grants_ever_for_user,
        active_grant_on_profile: r.active_grant_on_profile,
        distinct_ips: r.distinct_ips,
        shares_ip_with_staff: r.shares_ip_with_staff,
        record_issues_by_org: r.record_issues_by_org,
        supplied_fields_by_org: r.supplied_fields_by_org,
        audit_trail: r.audit_trail,
        classification,
        reasons,
        founder_action_required: classification === 'POTENTIAL_REAL_CLAIM' || classification === 'UNKNOWN',
      };
    });
  } finally {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    await client.end();
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ src: 'claim-v2-baseline', event: 'failed', message: error instanceof Error ? error.message.slice(0, 200) : 'error' }));
  process.exit(1);
});
