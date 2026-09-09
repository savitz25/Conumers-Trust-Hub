# Control Plane Recovery Retention

This policy governs Neon recovery and validation assets for Control Plane database migrations. It does not authorize schema or production-data changes, and branch quota pressure alone is never sufficient reason to delete a recovery asset.

## Retention classes

Long-lived assets are:

- the canonical Production branch;
- one baseline snapshot where the provider and quota support it; and
- the latest one or two meaningful pre-migration recovery branches.

Validation branches are ephemeral. They exist to prove an exact migration against a production-derived schema before permanent application.

## Migration lifecycle

Before a Control Plane migration:

1. verify the canonical project, Production branch, database, schema state, and recovery capability;
2. create a current recovery point without deleting an existing asset merely to obtain quota;
3. create a separate validation branch;
4. apply the exact checked-in migration to validation and require the ticket's expected schema-diff and security proofs; and
5. apply to Production only after the recovery and validation gates pass.

A validation branch may be deleted only after all of the following are true:

- the validated migration committed successfully to Production;
- the matching application version deployed successfully;
- Production database and application regressions passed;
- the activation record was committed and merged; and
- the stabilization check found no unresolved migration or runtime issue.

After stabilization, delete the obsolete validation branch and rotate older recovery branches so that the latest one or two meaningful pre-migration points remain. Every deletion requires an explicit inventory, exact approved target names and IDs, dependency checks, and a post-deletion inventory. Never perform automatic quota-driven cleanup.

## ATH-ADMIN-006B consolidation record

On 2026-09-09, project `asktrusthub-platform` (`hidden-glitter-26313488`) was consolidated after Migration 016 and its application deployment were verified stable. No schema or production data was changed.

Retained:

- Production `production` (`br-square-frog-aeqbig90`);
- baseline snapshot `pre-ath-admin-011-true-runtime-2026-09-09` (`snap-proud-mud-aelowv17`);
- pre-Migration-015 recovery `ath-admin-005-recovery-2026-09-09` (`br-twilight-mode-ae3o1izc`); and
- pre-Migration-016 recovery `ath-admin-006-recovery-2026-09-09` (`br-fancy-flower-aev55ltw`).

Deleted after the lifecycle gates passed:

- `ath-admin-011-true-runtime-validation` (`br-curly-lab-ae4d08yb`);
- `ath-admin-003-012-validation` (`br-hidden-term-aejippw8`);
- `pre-ath-admin-003-012-recovery-2026-09-09` (`br-patient-grass-aecc5nbv`);
- `ath-admin-004-validation` (`br-dark-hat-ae3rcnk9`);
- `ath-admin-004-recovery-2026-09-09` (`br-still-water-aequh26y`);
- `ath-admin-005-validation` (`br-fancy-sunset-aecki3a3`); and
- `ath-admin-006-validation` (`br-old-forest-aeqj062u`).

The resulting branch inventory is 3/10, leaving seven slots free. The separately retained baseline snapshot remains available. ADMIN-007 therefore has capacity for one recovery branch and one validation branch, subject to its own fresh pre-migration verification.

The Neon project `damp-silence-97233272` is a non-runtime project requiring a later cleanup review and was not accessed or modified by this consolidation.
