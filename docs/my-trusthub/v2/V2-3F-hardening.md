# V2-3F pre-integration hardening

2026-09-19. Parent PR185 base `203c24d1d5597641bcbc1a130d9fe7e363392c3c`.
Move157 stays `f317fd87847e4ba27e7d0d74ca9eb99207ea11b5`.
Production and provisioning HOLD. No hosted SQL, Auth, settings or data accessed.

## Transaction capability — implemented, hosted migration UNAPPLIED

Forward: `supabase/migrations/20260919205200_my_trusthub_v23_transaction_capability.sql`.
Rollback: `V2-3F-rollback.sql` (revocation, not deletion of research).
Supersedes the earlier V2-3R permission proposal; do not apply both proposals.

| Role | Exact capability | Explicitly denied |
| --- | --- | --- |
| myth_v23_authorizer | Insert/read/delete this backend + transaction's verified authority; clear transaction markers | P12 tables/Save, workspace enumeration |
| myth_v23_executor | Scoped runtime records/quota and three private wrapper calls | Authority insert, direct P12/P13, private workspace tables |
| myth_v23_foundation | Non-login wrapper owner; exact network binding, P12 Save/Project and P13 consume | Login, BYPASSRLS, superuser; not granted to application login |
| myth_v23_browser_store | Exact opaque-cookie-hash confirmation row | Consumer tables, P12/P13, arbitrary workspace access |
| myth_v23_cleanup | Expired metadata SELECT/DELETE | UPDATE, consumer Saved/Project/notes tables |

All new roles NOLOGIN/NOINHERIT/NOBYPASSRLS/NOSUPERUSER. Migration grants no
membership to any existing login. Every new table uses ENABLE + FORCE RLS.
Parent identity comes from independently verified server context deposited in a
protected transaction row, not user_metadata, JSON consumerId or a caller-set GUC.
Private wrappers set the existing P12 subject only after capability validation.
Existing audited P12/P13 functions remain dependencies; no new service_role fallback.

`AuthorizedPostgresBackend` supplies serializable transactions, per-key locks,
bounded retry/timeouts, P13 validation before grant storage and pre/post current
principal validation. Save validates exact binding, active terminal entity, validity,
grant, session, browser and selected manifest. Project can use only the Saved ID
produced in this transaction. Membership errors use a savepoint: Save and durable
receipt remain atomic while Project reports failed. Receipt failure rolls Save back.

Trust boundary: parent authorizer connection is privileged to attest verified
identity; it must never be issued to a specialist, browser or arbitrary SQL endpoint.
An application server compromise is not prevented by labelling a connection scoped.
The injectable `verify` port must independently authenticate, not echo supplied data.

## Local SQL / negative-access evidence

`npm run check:my-trusthub-v2-3f` uses existing PGlite in memory, with actual repository
P11/P12/P13 SQL plus the new migration. Supabase-managed Auth primitives, users,
source publication and service/session verifiers are isolated fixtures/MOCKED.
No connection string, hosted branch or production data is used.

Executed: real P13 consume, exact P12 Save, membership, durable receipt, duplicate
retry, foreign Project savepoint failure, receipt-insert failure rollback, expired
grant denial, current A receipt recovery after session renewal, changed Project
rejection, B receipt denial, wrong hub/scope denial, anon/BFF/executor workspace
denial, unbound authenticated zero rows, executor authority-insert denial, direct
P12 denial even with forged subject GUC, forced-RLS assertions, browser checkpoint
durability and owner-switch denial, cleanup and rollback research preservation.

This is LOCAL SQL evidence, not real Supabase, concurrent pooled-server or provider
certification. Real engine/grant/role membership and provider QA remain required.

## Durable records and browser confirmation

PostgreSQL stores stages/continuations/grants/receipts/quotas. Browser confirmations
use a separate PostgreSQL cookie-capability store, explicit dedicated-session
affinity, bounded nonblocking advisory serialization and short checkpoint
transactions. Transaction-mode poolers are NOT compatible with that store.
No SQLite backend is installed in deployed Next. SQLite remains test harness only.

Source snapshot carries source-owned `requestPrefix`, preventing parent-created
request keys from diverging from Move's receipt mapping. It is S2S data, not a new
browser form field. Persist context candidate before P13 consume; restart verifies
the already-committed same-session context rather than replaying a consumed handoff.
Project choice is fixed with that candidate. Account changes require a fresh flow.

`/my/profile-save` implements fixed-target form arrival, account continuation,
explicit selection, optional Project, commit, receipt and bounded return. Six browser
protocol tests cover this; they use mocked Auth/source and local runtime storage,
not a real browser/provider journey in this turn. No URL success marker is trusted.

`isolated-adapters.ts` assembles the durable stores and runtime behind approved
origin/backend gates. It does not open a connection or consume secrets. Current
Next route still supplies null deployment ports and is unavailable by default.
Remaining CODE wiring: concrete verified source S2S/P13/session/Project mapper,
scoped pool construction and receipt acknowledgment transport must be installed in
Next after their exact recovered/approved environment interface is reviewed. Flags
alone cannot make this work. Do not label the deployed path integration-ready yet.

## Receipt recovery and retention

Fresh current server-verified parent session + exact operation context permits
owner receipt lookup after grant expiry for 30 days. It does not renew a grant,
replay P13, authorize another commit or let a changed item/Project reuse a receipt.
Runtime and SQL fixture tests exercise this separately from browser checkpoint retry.
Public browser receipt-recovery transport still needs the concrete verified ports.

Stage/continuation/grant authorization expires in at most ten minutes; metadata and
browser confirmation cleanup age is one hour. Receipts: 30 days. Quotas: one day.
Cleanup batches are capped at 500 and require bounded statement/lock timeouts.
DELETE performs locking; SELECT FOR UPDATE was removed because it incorrectly
required UPDATE authority for the cleanup role. Local SQL exercises the real grants.
No cron, worker or cleanup executed remotely; no Saved research is a cleanup target.

## Identity and housekeeping

First Move binding remains BLOCKED as detailed in `V2-3R-first-move-binding-review.md`:
Company.id `usdot-1002530`, class `mover`, public route
`/companies/hindman-isaacs-moving-storage-inc`. Publication PUBLISHABLE is historical
Builder 3 evidence, not current provenance proof. Need exact source record/version,
namespace, current entity/redirect/conflict lookup and steward decision. Do not
nominate a new network entity or infer a match by slug/name/email/geography.

Insurance55 was rechecked at exact `84f54f5ac1fce816d58d9934650e17d3dc1ea806`;
thread `PRRT_kwDOTJsMfc6kCgcl` was already resolved. No additional mutation needed.
Legacy QA PASS and Move157 acceptance are prior evidence, not newly rerun here.

Verdict: substantial code/SQL hardening delivered; parent runtime PARTIAL because
the concrete deployed trusted-port wiring remains absent. First binding BLOCKED.
Environment checklist prepared, not permission to execute. Real sync NOT VERIFIED.
