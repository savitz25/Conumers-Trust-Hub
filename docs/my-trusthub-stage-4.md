# My TrustHub Stage 4 closeout evidence

Recorded 2026-09-10. **Stage 4 remains OPEN; Stage 5 is not ready.** Secure Contractor Save and unattended runtime/scheduling are deployed and production-tested. The remaining acceptance gap is a current, compatible observation from the real source for the selected exact credential. Additional hub adapters and Move resume are not blockers.

## Exact production matrix

| Hub | Save handoff | Resume handoff | Watch capability | Source monitoring | Deferred gaps |
|---|---|---|---|---|---|
| Ask | Live receiver for the exact Contractor profile only | Parent saved inventory remains readable; no cross-domain Move consumer | Parent UX for contractor.fl.dbpr.license_status v1 | Daily scoped DBPR scheduler deployed; current exact record unavailable | Accepted compatible unattended observation |
| Contractor | Live: CCC1332036 / native 0001ac38-0c96-4e2f-8bf6-9ab243f7b79b only | Unsupported | contractor.fl.dbpr.license_status v1 | Parent-owned daily DBPR extract check | Other profiles and source states outside the approved v1 contract |
| Move | Deferred; CTA omitted | Deferred: itemized calculator cannot reconstruct inventory from aggregates | Deferred | No My TrustHub adapter | Scoped P13 integration and aggregate P18 receiving model |
| Lender | Deferred; CTA omitted | Unsupported | Deferred | No My TrustHub adapter | Hub/class-specific P13 and Watch certification |
| Insurance | Deferred; CTA omitted | Unsupported | Deferred | No My TrustHub adapter | Hub/class-specific P13 and Watch certification |
| Senior | Deferred; CTA omitted | Unsupported | Deferred | No My TrustHub adapter | Hub/class-specific P13 and Watch certification |
| Investor | Deferred; CTA omitted | Unsupported | Deferred | No My TrustHub adapter | Hub/class-specific P13 and Watch certification |

Insurance main advanced independently to e79ed2c3cd4e709ab83bc86be1e095747ef0bb32 during closeout; the current production version was retained and smoke-tested. Other untouched specialist mains remained at the supplied revisions. Immutable deployment/revision evidence is in artifacts/my-trusthub-stage-4.json; its deployment snapshots precede the containing documentation commit.

## Certified Contractor P13 Save

The CTA is shown only for CCC1332036, native profile 0001ac38-0c96-4e2f-8bf6-9ab243f7b79b. Contractor posts to Ask, which prepares a 90-second intent for the authenticated canonical founder. An opaque intent returns to Contractor; its server issues an opaque code at Ask using the Contractor-only credential. The browser posts that code back to Ask and completes the idempotent consumer Save.

Intent, code, state, and nonce are random 32-byte values; stored references are SHA-256 hashes. Parent host-only Secure/HttpOnly/SameSite=Lax cookies bind browser state and nonce. Origin checks, fixed issuer contractor, fixed audience ask, exact destination allowlists, canonical user binding, TTL, atomic single-use consumption, and replay rejection are enforced. POST-to-GET bounces allow the parent session cookie to be used safely after a cross-site POST. Relay pages contain no analytics; strict-origin preserves the browser Origin header while disclosing no path or code. No consumer token or payload enters a URL.

The real browser round trip completed at 13:32 UTC. Production HTTP certification additionally rejected an identical code/state replay, missing issuer credential, wrong issuer, wrong audience, and hostile start Origin. The canonical founder sees the existing Saved entity; Save did not create a second entity or a Watch. Contractor receives no consumer identity or workspace state. Public rank, claim, and evidence mutations are outside the broker's grants.

MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED became true only after that real certification. The temporary canary certification gate was then removed from the application. Unsupported profiles omit the CTA.

## Scoped runtime grants and secret handling

Both new database roles are LOGIN, NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS. They have no role memberships, table grants, arbitrary consumer reads, other application SECURITY DEFINER access, network/ops governance, or Alert fanout privileges.

- myth_p13_save_runtime: USAGE on ops and EXECUTE only on prepare_contractor_save(text,text,text,uuid), issue_contractor_save(text,text,text,text), consume_contractor_save(text,text,text,uuid,text,text).
- myth_p15_dbpr_runtime: USAGE on ops and EXECUTE only on dbpr_poll_targets() and run_dbpr_poll(text,timestamptz,timestamptz,timestamptz,jsonb,text).

The poll wrapper fixes the capability, version, source, namespace, jurisdiction, and active enabled targets. It accepts only bounded credential/status rows and documented failure codes. It uses the existing P15 checkpoint, normalization, observation, deterministic event and mass-change quarantine logic. It cannot release quarantine or enumerate arbitrary private data.

Passwords were independently generated from 48 random bytes; only SCRAM verifiers were used for database activation. Runtime URLs and the Contractor issuer credential are Vercel sensitive Production variables. Ask holds the two scoped database URLs and CA; Contractor holds only its issue credential. Nothing is NEXT_PUBLIC. TLS verifies the official Supabase CA and pooler hostname. No broad service-role key is used by these runtimes.

Production credential tests passed 27 checks, including null/mismatched issuer, audience and canonical-user inputs, denied reads across consumer/network/ops/auth, role escalation denial, and the exact callable grants. Catalog review found no table access or additional application definer functions. Seven production RLS/authorization assertions covered founder, transaction-scoped Consumer B, Business Manager, anonymous, specialist and browser schema isolation. Test subjects rolled back.

A short-lived administrative certification function established only the existing founder test session without sending email. It was immediately replaced by a JWT-protected 410 tombstone; its challenge expired. It is not part of the handoff runtime. Credentials and session files are excluded from Git and the evidence artifact.

## Real source result and remaining acceptance gap

The deployed adapter downloads the existing authoritative [DBPR construction extract](https://www2.myfloridalicense.com/sto/file_download/extracts//CONSTRUCTIONLICENSE_1.csv), validates its CSV schema and exact prefixed credential identity, and normalizes only compatible v1 construction status flags. Numeric collision CRC1332036 cannot match CCC1332036. Missing, duplicate, incompatible or malformed records fail closed.

The real 2026-09-10 download was HTTP 200, 46,172,026 bytes and 258,689 records, with official Last-Modified 2026-09-10 10:48:32 UTC. **CCC1332036 was absent.** DBPR's [public records guidance](https://www2.myfloridalicense.com/construction-industry/public-records/) explains that delinquent, null-and-void and involuntarily inactive licenses are omitted. A separate exact official portal investigation found Delinquent,Active. That diagnostic portal lookup was not substituted for the approved extract, and no status was inferred from absence.

The selected v1 normalized vocabulary is active/current/inactive/expired/unknown. It was not silently expanded or reinterpreted to force acceptance. The accepted historical baseline remains intact; its older source clock came from specialist ingestion metadata and is not newly certified as an official publication timestamp. The latest checkpoint displays the actual official extract publication clock separately from retrieval.

To satisfy the remaining acceptance, the exact selected grain needs an authoritative compatible observation. That requires a compatible exact extract record or a separately governed source/status contract, followed by a successful real scheduler-path check. A fabricated row, numeric-only match, historical cache refresh, or silent coverage-version change is not valid evidence.

## Daily scheduler and clocks

Vercel's existing Pro plan now schedules GET /api/cron/my-trusthub-dbpr at 41 12 * * * (12:41 UTC daily). A daily cadence is conservative for a state professional-license source. Existing unrelated cron definitions are preserved. CRON_SECRET authenticates the scheduler; the separate scoped database role performs ingestion. No new service or plan was purchased.

The real production scheduler was invoked with vercel crons run /api/cron/my-trusthub-dbpr at 2026-09-10T13:27:35.273Z. It used the same configured production codepath and stored scheduler authentication as future unattended runs. HTTP 200 confirmed execution, while the application truthfully returned source_unavailable / SOURCE_IDENTITY_MISSING, checked 0, changes 0. Checkpoint e0015098-e2cc-4cb0-9542-bc1166a6c0b8 records source_as_of 10:48:32 UTC and retrieved_at 13:27:38.239 UTC. P15's completeness guard records RECORD_COUNT_COLLAPSE, partial completeness and unknown schema. This is certified failure handling, not a successful accepted current observation. The next scheduled wall-clock run is 2026-09-11 12:41 UTC.

Run locks and P15 fingerprints prevent duplicate observations/events; repeated checks can have separate operational checkpoints. The daily health policy also stops reassurance if two days of checks are missed. The existing 45-day source freshness expectation and two-day grace remain distinct from the daily check cadence.

## Watch UX and change detection

The founder's one active Watch retains one enabled v1 coverage row. The UI shows CCC1332036, fl.dbpr.license, the exact license_status grain, version 1, source fl.dbpr, Watch subscription state, official source-as-of, checked-at, last successful check, limitations and degraded health. It says no-change assurance is unavailable. The underlying failed checkpoint initially stores unknown health; the capability's degraded monitoring state makes the consumer health degraded. There is no broad company-monitored claim.

Six CSV adapter cases passed. Eight additional isolated checks exercised the new scoped wrapper itself: accepted baseline, unchanged values, material events, repeated values, missing-input failure, null-input denial, private-read denial and deterministic counts. Reproduce with node --test scripts/test-stage4-dbpr.mjs, node scripts/test-stage4-p15.mjs and node scripts/test-stage4-runtime.mjs. The isolated P15 database matrix passed 64/64: accepted baseline, same material value, material transition, duplicate/race fingerprints, out-of-order history, same-time conflicts, missing clocks, failure, schema drift, no-change truth conditions, version pinning and mass-change quarantine. Synthetic test observations were isolated and were not inserted into production. A missing production transition classifier was added as status_transition v1, license_status_changed, neutral P2 source-event severity. It does not create consumer Alerts. The live source omission produced zero observations, events, Alerts and deliveries.

## Kill switch, responsive checks and regressions

Master OFF was deployed as dpl_BdSnjtEpfnURhpkkR2m7jsbi1J87. Authenticated /my, /my/watches, handoff prepare and handoff start returned 404. The actual scheduler was triggered again at 13:37:50 UTC and added no checkpoint. The active Watch and enabled coverage stayed intact. This architecture intentionally stops source polling while the UI master switch is OFF; it does not pause or alter subscriptions. Master ON was restored and verified.

Changed Watch and Contractor CTA surfaces passed 1440/390/320 layout checks with no horizontal overflow or unnamed controls. The CTA has a 44px minimum target and visible keyboard focus. The Watch state label now explicitly says Watch, and the nested private-workspace main landmark was removed while retaining the focusable skip destination. Seven network homepages, Ask /ask and authenticated /my and /my/watches, Contractor search and exact profile, and Move's existing calculator returned 200. Ranking/publication safety suites remained green.

Move resume remains deferred: its current calculator and My Move Plan persist itemized name/volume/quantity/room entries and derive totals. The allowed move.inventory/v1 handoff has only aggregate room count and estimated cubic feet. Restoring itemized state would invent inventory or require a separate aggregate receiving model. No sensitive fields, payload URLs or fake reconstruction were added.

## Flags, counts and operational review

ON: MY_TRUSTHUB_ENABLED, MY_TRUSTHUB_WATCH_ENABLED, MY_TRUSTHUB_SOURCE_MONITORING_ENABLED, MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED, MY_TRUSTHUB_CANARY_ONLY. OFF: MY_TRUSTHUB_SIGNUP_ENABLED, MY_TRUSTHUB_ALERTS_ENABLED, MY_TRUSTHUB_EMAIL_ENABLED, MY_TRUSTHUB_EXPORT_ENABLED, MY_TRUSTHUB_DELETE_ENABLED.

Final certification counts: Auth users 1; profiles 1; Saved 2; Projects 2; research Sessions 2; Watches 1; enabled coverage 1; source observations 1; change events 0; Alerts 0; deliveries 0; P13 intents/Save handoffs 6; source checkpoints 2. The six intents include three successful real Save certification flows, one failed pre-fix browser attempt, and two isolated expiry probes. One early expiry probe was consumed before TTL elapsed without invoking Save; the correctly timed expiry rejection passed. These are operational audit rows, not extra consumer records.

Known-credential scans covered tracked files, staged additions and local browser bundles; 20 live browser bundles also contained no broker/ingestor credential or private runtime env marker. Runtime handoff URLs and reviewed logs contain no consumer tokens or opaque codes. The new code logs only bounded outcomes, counts and checkpoint identifiers.

Ask's new handoff foreign keys are indexed. Its remaining advisors are intentional closed-table RLS/no-policy information, unused indexes, Auth connection allocation, and the existing leaked-password-protection warning. Contractor had no database mutation in this release; its existing public-schema RLS/definer-view/search-path/extension findings remain outside this change. Runtime review found the unchanged business/claim pg sslmode deprecation warning and no new handoff/poller unhandled error; recent Contractor 5xx count was zero. These findings are not relabeled as a clean advisor inventory.

See the machine-readable artifact for exact revision/deployment snapshots and detailed passing security cases. **The remaining blocker is real-source acceptance, not credential provisioning, cron setup, additional Watch adapters, or Move resume.**
