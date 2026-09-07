# ATH-LAUNCH-001D funnel and measurement contract

Durable customer tables and append-only audit events are authoritative for claims, approvals, access, issues, responses, monitoring, and mail delivery. Vercel client analytics is behavioral context only.

| Stage | Measurement | Source | Authoritative |
|---|---|---|---|
| Eligible public profile | `BUSINESS_PROFILE_VIEWED` | client analytics | No |
| Claim CTA | `CLAIM_CTA_CLICKED` | client analytics | No |
| Handoff/auth/validation | existing claim-funnel events | client analytics | No |
| Claim started | claim row created | `ath_claims` | Yes |
| Review / needs information | claim status and review queue | customer DB | Yes |
| Approved | approved claim and management grant | customer DB | Yes |
| My Trust Hub opened | `MY_TRUST_HUB_VIEWED` | client analytics | No |
| Owner activated | first meaningful post-approval owner action | `ath_audit_events` | Yes |

Rates always display numerator and denominator. CTA rate is CTA clicks / eligible profile views. Start rate is claims started / CTA clicks. Completion rate is approved claims / started claims. Activation rate is approved owners with a post-approval owner action / approved owners. When client analytics cannot be queried server-side, the staff console does not fabricate these behavioral rates.

Meaningful activation actions are business information save or reconfirmation, record-issue submission, business-response submission, monitoring enablement, or team invitation. Email receipt is not activation. Acquisition sources are `organic`, `manual_outreach`, `email_campaign`, `internal_test`, and `unknown`; missing attribution remains unknown.

Exact identity appears only in the staff queue where operations requires it. Aggregate dimensions are limited to Hub, profile class, state, controlled source, lifecycle state, action type, and delivery status. Avoid rare cross-tab combinations.
