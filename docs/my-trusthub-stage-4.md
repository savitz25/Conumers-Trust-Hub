# My TrustHub Stage 4 closeout evidence

Recorded 2026-09-10. **STAGE 4 = CLOSED. READY FOR STAGE 5 = YES.** The exact Contractor Save handoff, explicit v1-to-v2 founder consent, scoped daily source runtime, and real production scheduler-path acceptance are certified. Alerts and email remain OFF. Readiness permits Stage 5 work; it does not activate it.

## Exact production matrix

| Hub | Save handoff | Resume handoff | Watch capability | Source monitoring | Deferred gaps |
|---|---|---|---|---|---|
| Ask | Live receiver for exact certified Contractor profile | Parent move.inventory/v1 retained; cross-domain consumer deferred | Parent UX for contractor.fl.dbpr.license_status v2; disabled v1 history retained | Daily exact DBPR lookup; two accepted real scheduler-path observations | Other hub/profile classes |
| Contractor | Live: CCC1332036 / native 0001ac38-0c96-4e2f-8bf6-9ab243f7b79b only | Unsupported | contractor.fl.dbpr.license_status v2 through parent | Parent-owned daily exact license lookup | Additional profiles and other grains |
| Move | Deferred; CTA omitted | Deferred: itemized calculator cannot reconstruct inventory from aggregates | Deferred | No My TrustHub adapter | Scoped P13 integration and aggregate P18 receiving model |
| Lender | Deferred; CTA omitted | Unsupported | Deferred | No My TrustHub adapter | Hub/class-specific P13 and Watch certification |
| Insurance | Deferred; CTA omitted | Unsupported | Deferred | No My TrustHub adapter | Hub/class-specific P13 and Watch certification |
| Senior | Deferred; CTA omitted | Unsupported | Deferred | No My TrustHub adapter | Hub/class-specific P13 and Watch certification |
| Investor | Deferred; CTA omitted | Unsupported | Deferred | No My TrustHub adapter | Hub/class-specific P13 and Watch certification |

Ask main advanced independently with Colorado work to 19d6601b6db2af6fa50078b35f93b421161b7447; Contractor advanced with Virginia work to e3168916ea437af20147aff0ebe31df77acc34a4. Those changes were retained and the current network smoke passed. Insurance's earlier independent e79ed2c3cd4e709ab83bc86be1e095747ef0bb32 release is retained. The artifact records all seven immutable production deployments tested before this containing documentation commit.

## Versioned source contract and explicit consent

The approved capability is contractor.fl.dbpr.license_status **v2**, namespace fl.dbpr.license, grain license_status, FL. Its primary source is [DBPR Verify a Licensee / Search by License Number](https://www.myfloridalicense.com/wl11.asp?mode=1&search=LicNbr). The adapter submits the full CCC1332036 credential to Construction Board 06, resolves one unique official detail, then independently confirms the exact credential there. Numeric-core collision CRC1332036 cannot match. The bulk Construction extract is secondary discovery only.

DBPR's [public records guidance](https://www2.myfloridalicense.com/construction-industry/public-records/) states that its bulk extract excludes delinquent, null-and-void and involuntarily inactive licenses. Bulk absence is never normalized into inactive, invalid, active or safe. The old bulk-only v1 and its historical observations remain unchanged. Its failed historical checkpoint is retained as evidence, not used to degrade the enabled v2 lookup.

Registration created no coverage. At **2026-09-10 15:02:49.138315 UTC**, the authorized founder canary selected the initially unchecked consent and submitted **Upgrade to version 2** in the production browser. The form explained the improved source coverage, separate statuses and unknown official clock, with no new grain. Receipt revision **dbpr-exact-lookup-v2/2026-09-10** was stored in paired coverage_removed / coverage_added events 266 and 267. The same Watch retained its identity and active state; row version advanced 5 to 6. Its v1 coverage was disabled with consumer_upgraded_to_version_2; one v2 row became enabled. Earlier enabled_at and history were preserved. Missing consent, stale versions, unrelated capabilities and another user are rejected; retry is idempotent. Pause/resume and restart retain selected versions.

See [the immutable v2 source contract](my-trusthub-dbpr-v2-source-contract.md) for the complete normalization and clock policies. Production records migrations my_trusthub_dbpr_v2 as 20260910143944 and my_trusthub_dbpr_v2_validation as 20260910144237. Their committed migration files are timestamped 20260910142334 and 20260910144104 respectively; both were applied before application deployment.

## Exact official lookup and real production polling

The exact official [CCC1332036 detail](https://www.myfloridalicense.com/portalsearches/VerifyLicensee/LicenseDetail?ID=EA5C6D8D8BF68DA859387B39EBCDDB02) returned **Delinquent,Active**. V2 preserves primary **delinquent** and secondary **active** as independently material fields, with the original official string retained as bounded metadata. DBPR's [renewal FAQ](https://www2.myfloridalicense.com/construction-industry/faqs/) explains that secondary Active describes the pre-delinquency state; it does not override Delinquent.

The official page publishes no record-as-of timestamp. source_as_of remains NULL, rendered as **Not published by DBPR**. The page's render clock, expiration date and retrieval time are not relabeled as official publication time. Retrieval and database observation timestamps remain separate; P15 explicitly orders this undated source by retrieval.

Vercel's existing Pro plan schedules authenticated GET /api/cron/my-trusthub-dbpr at **41 12 * * ***: **12:41 UTC daily**. Daily is a conservative state-license cadence. Existing other crons are unchanged; no new paid service was added. CRON_SECRET authenticates the scheduler and the separate scoped ingestor performs database operations.

The exact production scheduler codepath was invoked through **vercel crons run /api/cron/my-trusthub-dbpr**, using Vercel's configured authentication, on deployment **dpl_ddWW6gMDG26Xv5q5GPCjgo9xAY8x**, main 4042dae6457d1824fcc3a56745613ccda0fbaee5:

| Invocation UTC | Result | Checkpoint | Retrieved UTC | Observed UTC |
|---|---|---|---|---|
| 15:03:17.776 | Accepted v2 baseline | b6f1eb7b-923f-4e1c-8fa1-33f3a5cf72e1 | 15:03:21.096 | 15:03:21.097977 |
| 15:04:23.627 | Accepted same-pair check; no_change | c0640c07-c010-41c5-89d2-2ccbc04acd78 | 15:04:26.748 | 15:04:26.750228 |

Both checks were complete, compatible and current with source_as_of NULL, one exact record, zero material changes and no quarantine. Observations f69064ee-1ee6-4916-8683-48cf48e140d9 and c76e36b6-8f43-4a2d-b367-84aff33b203d are accepted. A later real retrieval may create another observation/checkpoint while the same material pair creates no change event; an identical run is deduplicated. The first v2 baseline is not treated as a transition from the differently governed v1 baseline. The first future unattended wall-clock run is September 11 at 12:41 UTC; that future run has not yet occurred.

## Watch health and change detection

The live founder /my/watches shows CCC1332036, exact namespace and grain, active Watch state, enabled version 2, disabled version 1 history, DBPR exact-lookup source, both official statuses, unknown source-as-of, checked-at, last successful check and limitations. Health is **current** for the latest compatible lookup, independent of whether the license itself is current. Bulk exclusion no longer causes permanent degradation. There is no broad company-monitored claim.

The source contract uses one-day check freshness plus one-day grace. Failed, delayed, unknown, schema-incompatible or quarantined sources suppress no-change assurance. Transient failure can recover on a compatible fetch; schema drift and mass quarantine require review. Only complete, compatible unchanged checks permit the bounded no-material-change statement.

Nine exact-lookup parser/normalizer tests, **57 v2 SQL runtime assertions**, the existing **64 P15 assertions**, eight v1-wrapper checks, all P11-P19 contract checks, TypeScript, targeted ESLint and the optimized production build passed. The v2 matrix covers separate primary/secondary transitions and deterministic events, repeated values, run idempotency, transient failure/recovery, delayed health, schema review, duplicate identities, ordering, same-time conflicts, URL/field/clock rejection, consent pinning and mass-change quarantine. Synthetic changes were isolated in PGlite with all P11-P19 tables and never inserted into production. Consumer Alerts and deliveries remained zero. The runtime cannot fan out Alerts or release quarantine.

## P13, scoped grants and authorization

The live Contractor CTA remains restricted to CCC1332036 / native 0001ac38-0c96-4e2f-8bf6-9ab243f7b79b. The previously certified real browser Save round trip used the canonical founder and exact network binding 54000000-0000-4000-8000-000000000002. Repeated Save produced no duplicate Saved entity or Watch, and no ranking or claim mutation. Unsupported profiles omit the CTA.

P13 preserves random opaque references, SHA-256 storage, 90-second TTL, issuer contractor, audience ask, parent Secure/HttpOnly host-only browser-state/nonce cookies, fixed destinations, Origin validation, atomic consumption and replay rejection. No consumer token, payload or opaque code enters a URL; Contractor receives no consumer identity or private workspace state. Production HTTP issuer/audience/replay/expiry certification remains valid; the implementation is unchanged by v2. Twenty-seven actual credential checks passed again after founder upgrade, including exact binding, state/nonce/user/issuer/audience rejection, replay, denied schemas and role escalation.

Both runtime roles are LOGIN, NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS, with zero role memberships and table grants:

- myth_p13_save_runtime: ops USAGE and EXECUTE only on prepare_contractor_save(text,text,text,uuid), issue_contractor_save(text,text,text,text), consume_contractor_save(text,text,text,uuid,text,text).
- myth_p15_dbpr_runtime: ops USAGE and EXECUTE only on dbpr_poll_targets(), run_dbpr_poll(text,timestamptz,timestamptz,timestamptz,jsonb,text), dbpr_v2_poll_targets(), run_dbpr_v2_poll(text,timestamptz,timestamptz,jsonb,text).

The v2 wrapper fixes source/capability/version/grain and active enabled targets; validates bounded fields, exact identities, official/normalized status agreement, allowlisted URL and clocks; and calls existing P15 checkpoint/observation/event/quarantine logic. It has no consumer reads or unrelated mutation powers. Runtime URLs and the Contractor issuer secret are sensitive Production-only Vercel variables; they are never NEXT_PUBLIC. TLS verifies the official Supabase CA and pooler hostname. No broad service-role key is used by the broker or poller.

Eight additional post-consent production authorization assertions passed: founder sees one Watch and its accepted status; Consumer B sees zero and cannot read the status projection; Business Manager sees zero founder Watches; anonymous is denied; browser network/ops reads are denied. Earlier missing-consent and other-user upgrade checks also passed. Test subjects and role-test intents rolled back. A temporary founder-certification function was immediately replaced by a JWT-protected 410 tombstone; no email was sent.

## Kill switch, responsive checks, network and operations

Master OFF deployment **dpl_2GTbC9WkwCApxzBwuY9hn8fbwY6b** returned 404 for authenticated /my, /my/watches, handoff prepare and handoff start. The actual scheduler was invoked at **15:07:25.436 UTC** and the checkpoint count stayed four. The active Watch, row version 6 and one enabled v2 coverage remained unchanged. This architecture intentionally stops monitoring with the UI master flag; it never silently pauses subscriptions. Master ON was restored on **dpl_BX7KeKhvK5sZWsBfQvt8ZzFu9abz**, incorporating the newer Ask main, and authenticated current-health rendering was verified.

The explicit upgrade and accepted-status Watch surfaces passed **1440/390/320** checks with no horizontal overflow, unnamed buttons or duplicate main landmark. A routine mobile flex-wrap defect was fixed and retested. Contractor's previously certified 44px Save CTA and keyboard focus are unchanged. All seven production homepages, Ask search and authenticated /my and /my/watches, Contractor search/exact profile and Move calculator passed: **13/13 HTTP 200**. Public ranking/claim safety suites remain green.

Known runtime values and raw scoped passwords were scanned against Git files, additions and client bundles. Twenty live browser bundles contained no broker/ingestor secret or private runtime marker. Reviewed URLs and logs contain no handoff code or consumer session token; application logs use only bounded outcome/count/checkpoint metadata. Recent Ask and Contractor 5xx counts were zero. The existing unrelated business/claim pg sslmode deprecation warning remains; it is not a poller regression.

Supabase advisors found no new Stage 4 regression: twenty intentional closed-table RLS/no-policy INFO findings, thirty unused-index INFO findings, an Auth connection-allocation INFO finding and the existing [leaked-password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Existing Contractor public-schema RLS/definer-view/search-path/extension findings remain outside this release, which makes no Contractor database change.

## Flags, counts and deferred work

ON: MY_TRUSTHUB_ENABLED, MY_TRUSTHUB_WATCH_ENABLED, MY_TRUSTHUB_SOURCE_MONITORING_ENABLED, MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED, MY_TRUSTHUB_CANARY_ONLY. OFF: MY_TRUSTHUB_SIGNUP_ENABLED, MY_TRUSTHUB_ALERTS_ENABLED, MY_TRUSTHUB_EMAIL_ENABLED, MY_TRUSTHUB_EXPORT_ENABLED, MY_TRUSTHUB_DELETE_ENABLED. Source monitoring selects only certified, enabled, version-pinned coverage.

Final counts: Auth users **1**, profiles **1**, Saved **2**, Projects **2**, research Sessions **2**, Watches **1**, enabled v2 coverage **1**, disabled historical v1 coverage **1**, source observations **3** (one historical v1 and two accepted v2), source checkpoints **4**, change events **0**, Alerts **0**, deliveries **0**, P13 intents **6**, P13 Save handoffs **6**. Consent and polling created no extra consumer entities.

Nonblocking deferrals: Move cross-domain move.inventory/v1 resume needs a separate aggregate receiving model because its current calculator stores itemized inventory; additional specialist Save classes and Watch adapters need their own certification. Discipline, Sunbiz, permits, lawsuits, reviews and other grains are not added. Stage 5 Alert activation and later email/export/delete work remain separate. There are **no remaining Stage 4 acceptance blockers**.
