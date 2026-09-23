# ATH-CLAIM-V2-001 — Abuse Model

## Threat: passive crawlers manufacturing signed claim artifacts

Before this ticket a crawler, link prefetcher, or scripted client that followed the public
`/api/claim/handoff/[profileId]` link received a fresh signed token per request and, on Ask, each token became
a durable `ath_claim_intents` row. 5,997 historical intents with 4 consumptions is the symptom.

## Defence in depth (what ships)

| Layer | Where | Mechanism | Durable? |
| --- | --- | --- | --- |
| 1. No mint on GET | Contractor `GET /api/claim/handoff/[id]` | 405 + `Allow: POST`, safe next links, `no-store`, `noindex` | n/a |
| 2. Human action | Contractor CTA | Same-origin POST form (button); works without JS | n/a |
| 3. Same-origin | Contractor `POST` | `Origin` must equal request origin or canonical site origin; else `Sec-Fetch-Site: same-origin`; otherwise 403 before any DB read | n/a |
| 4. Bounded abuse gate | Contractor `POST` | per IP 5 / 15 min; per IP+profile 3 / 15 min; per IP 20 / 60 min; 429 + `Retry-After: 900`; **fails closed (503) if the store errors**; memory bounded to 5,000 keys | **No — per isolate** |
| 5. Rollout + eligibility | Contractor `POST` | `ATH_CLAIM_CTA_MODE` gate, exact FL DBPR non-thin profile | n/a |
| 6. One short-lived token | Contractor mint | 15-min HMAC token, random nonce, never logged | n/a |
| 7. Receipt limiter | Ask `GET /api/customer/claim/accept` | `handoff_ip` 30 / 15 min in `ath_rate_events` | **Yes** |
| 8. No durable state on receipt | Ask | verify + revalidate only; receipt cookie; 0 intents for any number of views | n/a |
| 9. Explicit Continue | Ask `POST /api/customer/claim/confirm` | same-origin; `claim_continue_ip` 10 / 15 min in `ath_rate_events`; nonce UNIQUE; receipt-bound idempotency | **Yes** |
| 10. Auth + attestation + human review | Ask | unchanged | Yes |

Net effect: an attacker who defeats layers 1–4 (e.g. by scripting POSTs from many IPs with a forged Origin
header) obtains tokens that create **nothing** on Ask until a same-origin browser session presses Continue,
which is itself durably rate limited per IP. Minted-but-unused tokens expire in 15 minutes and are not
recorded anywhere.

## Honest statement about layer 4

ContractorTrustHub has no durable rate-limit store: no KV/Redis, no rate table, and its only Postgres is the
DBPR evidence database. `MemoryRateLimitStore` is per serverless isolate and resets on cold start; under
concurrency multiple isolates each hold their own counters. It is shipped as **bounded, fail-closed, clearly
labelled non-durable** protection — not as fleet-wide durable protection. The durable backstops for the
network are layers 7 and 9 on Ask, plus the fact that minting no longer creates state.

## Options for a durable Contractor gate (Founder decision; not implemented)

1. **Vercel WAF rate-limit rule** on `POST /api/claim/handoff/*` (no new vendor; a production configuration
   change, therefore Founder-only).
2. **Small Contractor Postgres table** (`claim_start_rate_events(key, created_at)`) behind the existing
   `RateLimitStore` interface. This would put an operational table in the evidence database — an
   architectural exception that needs explicit approval and a reviewed migration.
3. **Ask-hosted pre-flight** (`POST asktrusthub.com/api/customer/claim/preflight` returning a short-lived
   allowance keyed by IP) so the durable `ath_rate_events` limiter fronts the specialist mint. Adds a cross-site
   call per claim start; would need its own origin/CSRF model.

Recommendation: option 1 first (zero code), option 3 if a code-level durable gate is still wanted.

## Adaptive challenge

No CAPTCHA is added for normal users. No challenge vendor exists in either repo; none is introduced
(prohibited without Founder approval). If a challenge provider is adopted later it belongs between layers 4
and 5, applied only to traffic that has already tripped a bound.

## Test evidence

- Contractor `scripts/test_ath_claim_v2_001.tsx`: 1,000 GETs → 0 mints/405; POST → exactly one Ask-valid
  token; wrong/missing/cross-site origin → 403 and no DB read; invalid UUID / thin / rollout-off → 404, 0
  mints; per-IP burst → 429 after 5 with `Retry-After`; per-profile → 429 after 3; hourly bound 20; store error
  → 503, 0 mints; memory bounded; source allow-list; CTA is a form, never a link.
- Ask `lib/customer/ath-claim-v2-001.test.ts`: 1,000 receipts → 0 intents, 0 audit rows; refresh → 0;
  Continue → 1; double-click → 1; replay → `reused_nonce`; expired / tampered / wrong audience / thin /
  mismatched / cross-hub → fail closed; receipt 30/15m and Continue 10/15m limits; historical legacy rows
  byte-identical.
