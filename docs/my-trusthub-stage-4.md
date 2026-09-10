# My TrustHub Stage 4 certification

Date: 2026-09-10

Stage 4 activates one exact, parent-governed Watch capability for the closed founder canary. It does not activate Alerts, email delivery, public signup, or broad specialist federation.

## Production capability matrix

| Hub | Exact identity audited | Save handoff | Session resume | Watch | Source monitoring |
|---|---|---|---|---|---|
| Move | USDOT / mover profile | Deferred: P13 broker credential not deployed | Parent inventory schema is live; cross-domain P18 consume path not deployed | Deferred | Deferred |
| Lender | NMLS institution | Deferred: P13 broker credential not deployed | Unsupported | Deferred | Deferred |
| Insurance | Agency / producer / legal-insurer grains remain distinct | Deferred: P13 broker credential not deployed | Unsupported | Deferred | Deferred |
| Contractor | Exact native profile + state credential | Parent Save certified for one governed binding; specialist CTA deferred | Unsupported | **Live:** FL DBPR construction license status v1 | One accepted exact baseline; automated source-ingestor credential/schedule deferred |
| Senior | CMS CCN plus provider class | Deferred: P13 broker credential not deployed | Unsupported | Deferred | Deferred |
| Investor | Firm CRD distinct from individual CRD | Deferred: P13 broker credential not deployed | Unsupported | Deferred | Deferred |

The existing specialist network-auth implementations are not relabeled as P13 consumer handoffs. They do not possess the scoped `myth_handoff_broker` runtime credential needed to create/consume P13 single-use records.

## Activated Watch grain

- Capability: `contractor.fl.dbpr.license_status`
- Version: 1
- Source: Florida DBPR construction extract
- Identity: exact credential namespace `fl.dbpr.license`, jurisdiction `FL`
- Certified record: `CCC1332036`, exact Contractor profile UUID `0001ac38-0c96-4e2f-8bf6-9ab243f7b79b`
- Material field: normalized credential status only
- Source as of: 2026-08-10 22:49 UTC
- Production baseline check: 2026-09-09 23:51 UTC
- Freshness expectation: 45 days plus two-day grace
- Not watched: local permits, civil lawsuits, private reviews, insurance cancellation

The baseline is real public specialist evidence, not a fictional provider or adverse record. It is not enough to say “no change.” The UI therefore reports that no-change assurance is unavailable until a later current, complete, compatible observation evaluates to `no_change`.

## Consumer behavior

Saving remains independent of Watching. The founder explicitly selected the capability, producing one Watch and one version-pinned coverage row. Duplicate Watch creation is blocked/idempotent under P14. Pause, resume, stop, and restart passed. Project changes do not participate in Watch lifecycle.

`/my/watches` shows the exact source, capability version, coverage limitations, health, completeness, schema status, official source-as-of clock, and Trust Hub check clock separately. Unknown or degraded health never renders as “no change.”

P14 semantic immutability remains active: existing coverage stays pinned to capability version 1. Additional fields or sources require a new governed version and consumer selection; they cannot silently expand this Watch.

## Change detection and quarantine

The installed P15 contract remains the authoritative implementation for baseline, no-change, material transition, delayed/degraded/unknown health, out-of-order observations, same-effective-time conflicts, schema drift, duplicate observations, and mass-change quarantine. Its static contract checks passed in this release. Stage 4 added one accepted Production baseline and no consumer change event.

Alerts and delivery remain disabled. A P15 event, if later created, does not become a consumer Alert until a separate Stage 5 fanout decision.

## Security and remaining blocker

Founder ownership and transaction-scoped Consumer B isolation passed. P13 tables, network/ops schemas, and Watch internals remain browser-inaccessible. No specialist receives consumer tokens, email-based identity linkage, or access to private Saves, Projects, sessions, notes, or Watches.

Stage 4 is operational for the parent Watch experience, but full specialist handoff and unattended source polling are not certified. Closing those gaps requires deploying scoped broker/source-ingestor credentials; no general Supabase service key may be repurposed for this work.
