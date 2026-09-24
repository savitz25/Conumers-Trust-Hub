/**
 * ATH-CLAIM-V2-001 — frozen V2 first-party funnel contract (Section 5) and acquisition source (Section 6).
 *
 * AUTHORITATIVE events are durable first-party records (ath_claim_intents, ath_claims, ath_audit_events,
 * ath_management_grants, business publication tables). BEHAVIORAL events are privacy-safe browser/product
 * telemetry with low-cardinality dimensions only. A passive handoff receipt is never labelled as claim intent.
 */
import type { CustomerHubId } from './types.ts';

export const CLAIM_ACQUISITION_SOURCES_V2 = ['organic', 'manual_outreach', 'email_campaign', 'internal_test', 'unknown'] as const;
export type ClaimAcquisitionSourceV2 = (typeof CLAIM_ACQUISITION_SOURCES_V2)[number];

/** Deterministic: unknown or missing input never becomes a known bucket. */
export function claimAcquisitionSourceV2(value: unknown): ClaimAcquisitionSourceV2 {
  return typeof value === 'string' && (CLAIM_ACQUISITION_SOURCES_V2 as readonly string[]).includes(value) ? (value as ClaimAcquisitionSourceV2) : 'unknown';
}

// ATH-CLAIM-V2-001R2 (Q2): there is deliberately no `specialistDeclaredSource(queryStringValue)` helper here
// any more. Acquisition source is trusted ONLY when it comes from inside a signed handoff payload, verified by
// `parseAndAuthenticateHandoff`/`receiveHandoff` (see handoff.ts, store.ts). A query string or POST body value
// must never be sanitized-and-trusted this way again — sanitizing an untrusted input is not the same as
// authenticating it, and that gap was exactly the vulnerability this ticket closes.

export function toAttributionEnum(source: ClaimAcquisitionSourceV2): 'ORGANIC' | 'MANUAL_OUTREACH' | 'EMAIL_CAMPAIGN' | 'INTERNAL_TEST' | 'UNKNOWN' {
  return source.toUpperCase() as ReturnType<typeof toAttributionEnum>;
}

export type FunnelEventAuthority = 'AUTHORITATIVE' | 'BEHAVIORAL';
export type FunnelEventDefinition = {
  event: string;
  authority: FunnelEventAuthority;
  source: string;
  humanIntent: boolean;
  meaning: string;
};

export const CLAIM_V2_FUNNEL: readonly FunnelEventDefinition[] = [
  { event: 'claim_cta_viewed', authority: 'BEHAVIORAL', source: 'specialist browser analytics', humanIntent: false, meaning: 'Eligible public profile rendered the claim CTA.' },
  { event: 'claim_cta_activated', authority: 'BEHAVIORAL', source: 'specialist browser analytics + specialist server log', humanIntent: true, meaning: 'A person activated the CTA (POST claim start).' },
  { event: 'claim_handoff_minted', authority: 'AUTHORITATIVE', source: 'specialist server log (no token)', humanIntent: true, meaning: 'Specialist minted one short-lived signed handoff after origin + abuse + eligibility checks.' },
  { event: 'claim_handoff_received', authority: 'BEHAVIORAL', source: 'Ask browser/product event', humanIntent: false, meaning: 'Ask authenticated a handoff and rendered the identity page. Passive; creates no durable state.' },
  { event: 'claim_continue_confirmed', authority: 'AUTHORITATIVE', source: 'ath_claim_intents (intent_origin=explicit_continue) + ath_audit_events', humanIntent: true, meaning: 'Explicit Continue created exactly one durable claim intent.' },
  { event: 'claim_auth_required', authority: 'BEHAVIORAL', source: 'Ask browser/product event', humanIntent: false, meaning: 'Intent exists; account confirmation is required.' },
  { event: 'claim_auth_returned', authority: 'BEHAVIORAL', source: 'Ask browser/product event', humanIntent: false, meaning: 'Authenticated claimant returned to the same intent.' },
  { event: 'claim_submitted', authority: 'AUTHORITATIVE', source: 'ath_claims.created_at + audit claim_created', humanIntent: true, meaning: 'Claim entered the review queue.' },
  { event: 'claim_review_started', authority: 'AUTHORITATIVE', source: 'ath_claims.review_started_at + ath_claim_review_sessions', humanIntent: false, meaning: 'A named reviewer started an explicit review session.' },
  { event: 'claim_needs_information', authority: 'AUTHORITATIVE', source: 'ath_claims.status=needs_info + audit claim_needs_info', humanIntent: false, meaning: 'Reviewer requested more evidence.' },
  { event: 'claim_approved', authority: 'AUTHORITATIVE', source: 'ath_claims.status=approved + audit claim_approved', humanIntent: false, meaning: 'Human authority decision.' },
  { event: 'management_grant_activated', authority: 'AUTHORITATIVE', source: 'ath_management_grants.status=active + audit grant_created', humanIntent: false, meaning: 'Active management grant exists.' },
  { event: 'first_business_action', authority: 'AUTHORITATIVE', source: 'ath_audit_events owner activation actions after approval', humanIntent: true, meaning: 'First useful owner-controlled action.' },
  { event: 'business_profile_published', authority: 'AUTHORITATIVE', source: 'ath_business_profile_* rows projected under an active grant', humanIntent: true, meaning: 'Labelled business-supplied information is publicly projected.' },
  { event: 'business_reply_submitted', authority: 'AUTHORITATIVE', source: 'ath_business_replies.status=SUBMITTED', humanIntent: true, meaning: 'Business response entered moderation.' },
  { event: 'business_reply_published', authority: 'AUTHORITATIVE', source: 'ath_business_replies.published_revision_id', humanIntent: false, meaning: 'Approved business response is projected separately from evidence.' },
  { event: 'grant_revoked', authority: 'AUTHORITATIVE', source: 'ath_management_grants.status=revoked + audit grant_revoked', humanIntent: false, meaning: 'Management authority removed.' },
  { event: 'business_layer_withdrawn', authority: 'AUTHORITATIVE', source: 'public projection query (requires active grant) + public read cache invalidation', humanIntent: false, meaning: 'Business-supplied layer is no longer projected; official evidence unchanged.' },
] as const;

/** Behavioral events that the Ask browser may send to first-party product telemetry (in addition to the existing allow-list). */
export const CLAIM_V2_BROWSER_EVENTS = ['claim_cta_viewed', 'claim_cta_activated', 'claim_handoff_received', 'claim_continue_confirmed', 'claim_auth_required', 'claim_auth_returned'] as const;

/** Dimensions allowed in browser analytics for V2 claim events. Anything else is dropped by safeClaimFunnelProperties. */
export const CLAIM_V2_ALLOWED_DIMENSIONS = ['hub', 'profileClass', 'state', 'action', 'resultState', 'authenticated', 'source', 'ageBucket'] as const;

/** Never allowed in browser analytics or URLs. Enforced by lib/customer/claim-launch.ts and lib/analytics/privacy.ts. */
export const CLAIM_V2_FORBIDDEN_ANALYTICS = ['profile UUID', 'license number', 'claimant name', 'company name', 'email', 'claim ID', 'org ID', 'grant ID', 'magic link', 'signed handoff token', 'free text', 'raw URL/query with any of the above'] as const;

export type ClaimV2HubId = CustomerHubId;
