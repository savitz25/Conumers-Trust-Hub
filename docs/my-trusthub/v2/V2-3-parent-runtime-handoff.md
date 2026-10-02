# V2-3 parent runtime implementation handoff — production HOLD

Status: PARTIAL. Runtime library and local protocol harness implemented; live
Move → parent nonproduction sync is NOT verified or enabled.

## Immutable specialist interface

PR: https://github.com/savitz25/Conumers-Trust-Hub/pull/185

Stacked on PR #184, exact account/contract baseline
`b194642d56d31d90eeacd9458cf29266cfc6fc07`.

Use interface commit `26c4e9ed5c2d6ed8fbf3b3712516b7bbfdee3cd2`:
`lib/my-trusthub/profile-save/interface.ts` and
`docs/my-trusthub/v2/V2-3-parent-runtime-interface.md`.
Six typed POST operations use the approved selected-profile transfer contract.
No interface version or wire shape was changed by subsequent implementation.
Builder 3 can implement the specialist adapter against this immutable interface;
it must handle disabled/unavailable honestly and retain local research.

## Implemented

- Strict envelopes, bounded body/return destination, private responses, fresh
  trusted caller adapter boundary, feature OFF and unconditional production deny.
- Hashed opaque stage/continuation/grant/receipt keys, one-use continuation,
  owner/session/browser/hub binding, expiry, persisted rate quota, exact selected
  item and manifest checks, idempotency payload conflict detection.
- Durable receipt publication in the same transaction as P12 Save; optional
  Project membership has an independent result with savepoint failure isolation.
- Exact published profile/class/native-ID binding lookup, ambiguity rejection,
  binding row locks; existing P12/P13 parameterized foundation calls.
- Dependency-injected PostgreSQL serializable store with absent-key locks,
  bounded retry and rollback. No pool credentials or new role grants.
- Disk-backed SQLite LOCAL TEST adapter and real localhost HTTP protocol harness.
  Parent admission, P12/P13 persistence semantics and publication are fixtures.
  These are not real Supabase/RLS or authenticated-browser certifications.

## Remaining implementation and authorization dependencies

The deployed route intentionally has no live binding: OFF returns disabled;
even approved-looking nonproduction flags return unavailable. Flags alone are
not sufficient to enable it. Never attach the local fixture backend to Next.

1. Identify an existing approved isolated parent/BFF/database environment. No
   production credentials have been fetched or reused. User environment decision
   is pending; no new credential/permission/service is requested automatically.
2. Implement its verified session/admission, Origin/CSRF or BFF authentication,
   explicit selected-item confirmation, current exchange and Project-ref mapping.
   No caller-supplied account ID or raw JWT claim becomes a trusted owner.
3. Review the transactional capability boundary: existing P12 authenticated
   consumer and P13 broker roles are separate. The injected factory must authorize
   each operation on the transaction connection without granting a broad service
   role or silently bypassing ownership. This is not solved by a shared pool.
4. Review/apply storage only to an authorized isolated backend. The adjacent SQL
   is a proposal, NOT a migration and NOT applied. It intentionally grants no
   roles/policies. Validate actual PostgreSQL constraints, RLS, retries and P12/P13
   integration before enabling any runtime.
5. Wire the source-owned specialist stage manifest to the authenticated parent
   confirmation snapshot. The single-store fixture does not certify that split.
   Move must resolve public Company slug → Company.id / `mover`; fixture IDs and
   fixture classes are deliberately NOT deployment mappings.
6. Add reviewed receipt reauthorization after session change/grant expiry. Current
   receipts persist, but lookup requires the original unexpired owner-bound grant
   (10 minutes). Durable receipt existence is not indefinite lookup availability.
7. Establish retention/cleanup policy and run the actual Move adapter + parent
   browser journey against the isolated backend. Real account Save and parent
   sync remain NOT RUN. No HTTP 200/build substitutes for this journey.

## Reproduction and evidence (Windows, Node 22.18.0 / npm 10.9.3)

`npm ci --ignore-scripts --no-audit --no-fund` passed using committed lockfile.

| Command | Result / evidence |
| --- | --- |
| `npm run check:my-trusthub-v2-3-runtime` | 16 tests PASS plus localhost HTTP harness PASS |
| `npm run check:my-trusthub-v2-3` | PASS, approved contract regression suite |
| `npm run check:my-trusthub-v2-2` | PASS, account baseline suite |
| `npm run check:my-trusthub-p11-p19` | PASS, foundation checks |
| `npm test` | PASS, repository script (not a live backend test) |
| `npm run typecheck` | PASS after adding harness-only Node SQLite declarations |
| `npm run lint` | PASS, seven warnings in unchanged baseline files |
| `npm run build` | PASS, no environment pull or guard bypass |

R01–R11 exercise durable restart, concurrency, fingerprint conflicts, rollback,
Project partial failure, owner/session isolation, expiry/replay, receipt exactness,
capability rejection, malformed/oversized HTTP and denied-request quota.
R12–R14 are explicitly MOCKED SQL checks for foundations, exact binding lookup
and PostgreSQL transaction/retry plumbing. D01/D02 prove deployment fail-closed.
The HTTP harness exercises stage → continuation → mocked admission → consume →
Save → retry → lookup → verify → signout denial, preserving the original local
row including notes. No browser or live parent sync claim is made.

## Boundaries

Move V2-1 remains closed at `35a83ca97f98fb5ee46bb849569808fd5e962a90`.
No Move/Insurance/Lender runtime files, signup policy, Auth settings, database,
Watch/Alerts or production configuration changed. No merge, deployment command,
promotion, migration application, secrets creation or production mutation.
Keep PR #185 draft until the listed integration gaps have been reviewed.
