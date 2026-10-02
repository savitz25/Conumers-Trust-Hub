# First Move binding — governance approved, isolated execution pending

Approved: canonical `organization`, specialist `mover`, exact native ID
`usdot-1002530`, USDOT `1002530`, MC `421784`. All approved values and the exact
resolution note are in `V2-3BIND-isolated-create.sql`. No UUID is fabricated.

This is a manually reviewed operator script, NOT a migration/automatic test seed.
It has an unconditional exception before all INSERTs. Do not remove it before
separate founder approval names an isolated environment. No SQL execution, even
local fixture execution, was performed when preparing this script.

## Later authorized execution prerequisites

1. Pin approved isolated project/branch/host and actual connection identity outside
   SQL; reject production, inherited production credentials and unverified proxy
   targets. No caller-set variable or generic database name proves isolation.
2. Confirm P11 migration, forced RLS, governor privileges and enabled governance
   audit triggers. Use the approved operator; no browser claims or spoofed subject.
3. Immediately recheck the authoritative Move company: exactly one row for each
   native ID/slug/USDOT/MC; same approved candidate, `PUBLISHABLE`, allowed by current
   publication gate. Refresh exact FMCSA corroboration. The September 21 source
   timestamp in the approved note remains historical evidence, not the new check.
4. Record fresh checks in a sanitized evidence reference: current Move publication,
   exact identity, parent entities/bindings/redirects, target identity and approval.
   Any change stops creation and returns to the steward, even if apparently benign.
5. Prepare a newly reviewed target-bound copy replacing the unconditional stop.
   That runner sets session attestations `v23bind.preflight_checked_at`,
   `v23bind.candidate_unchanged`, `v23bind.evidence_ref` from actual verified checks.
   These attestations are trusted operator inputs, NOT standalone security proof.
6. Execute the single transaction with stop-on-error. Registry checks occur under
   governor RLS with entity/binding table locks. Conflict, timeout or serialization
   error rolls back both inserts and their audit effects. Stop for review; do not
   bypass checks or automatically retry with changed identity.
7. Capture generated entity/binding IDs and actual actor/timestamp; verify one exact
   organization-to-mover binding and audit events. Recheck publication after commit
   before starting integration. Cross-database publication cannot be made atomic
   by this parent-only SQL: integration must independently revalidate publication.

## Test fixture expectations — prepared, SQL NOT RUN

- Default script: stops before insertion, even on a privileged connection.
- Approved isolated copy + unchanged fresh evidence: exactly one entity and binding;
  generated IDs, generated normalized fields, approved actor, two governance inserts.
- Missing/stale/future attestation, changed publication/candidate, entity/binding
  conflict, redirect or second invocation: STOP; no new identity accepted.
- Injected binding failure: entity and audit inserts roll back with the transaction.
- No private consumer data, Save, Project, Watch, Auth or production settings touched.

Static file checks only are provided in `scripts/qa/v23bind-script.test.mjs`.
They do not claim PostgreSQL execution or cross-domain integration success.

MOVE BINDING GOVERNANCE = APPROVED

MOVE FIRST TEST IDENTITY = READY FOR ISOLATED CREATION

PRODUCTION BINDING CREATION = NOT AUTHORIZED

ISOLATED ENVIRONMENT = STILL PENDING FOUNDER/LAPTOP VERIFICATION

PRODUCTION = HOLD
