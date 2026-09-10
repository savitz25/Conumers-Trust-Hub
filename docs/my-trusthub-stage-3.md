# My TrustHub Stage 3 production certification

Date: 2026-09-09

Status: **STAGE 3 CLOSED — READY FOR STAGE 4**

Stage 3 activates the existing P18 Saved Session envelope for one deliberately narrow, real production contract: `move.inventory/v1`. It represents aggregate room-count and estimated-volume state compatible with Move Trust Hub's existing moving calculator. No provider fixture, public evidence, Watch, Alert, ranking signal, or lead is created.

## Supported and deferred sessions

Production supports Move inventory sessions (`inventory`, schema version 1) with `room_counts` and `estimated_cubic_feet`. Consumer summaries expose only a title, aggregate value/unit, and short label. Creation, mutable working-session update, current-version validation, many-to-many Project membership, device-local guest import, and private parent display are live.

Lender calculators and worksheets, Move comparisons/routes, Contractor comparisons, Insurance plans, Senior plans, and Investor worksheets remain unsupported in Production because no reviewed specialist adapter has registered those schemas. P18's approved migration-path behavior remains certified by its permanent SQL/static suite, but Production has no real version transition to register. Unknown, malformed, oversized, and sensitive payloads fail closed without deleting existing research.

## Resume coverage

My TrustHub validates the private session against P18 using its opaque `resume_ref`; neither payload nor resume reference enters the URL. The consumer can reopen and update the saved working state inside My TrustHub. Cross-hub resume remains honestly unavailable because `MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED=false` and Move has no deployed Stage 3 consumer adapter. The UI states that the compatible session is preserved and that Move resume is not available yet.

P18's broker/consumer contract was transactionally certified in Production: the first correctly scoped handoff consumption succeeded and replay returned `HANDOFF_ALREADY_USED`. No live cross-hub handoff row was retained.

## Production canary

The canonical founder created `Founder moving inventory — updated`, changed it from 6 rooms/1,100 estimated cubic feet to 7 rooms/1,250, removed and re-added its Project relationship, associated it with two Projects, archived/restored a Project, and confirmed the session persisted. A device-local `mytrusthub-guest-sessions/v1` item created `Guest moving inventory`; repeating the import was classified duplicate and did not create a third session.

A transaction-scoped idempotency proof returned one session identifier for two identical creates. Transaction-scoped negative cases rejected a prohibited `password` field, unknown version 99, and a payload missing its required volume field. Those test rows were rolled back.

## Privacy, authorization, and gates

Consumer B with simulated Business Manager/specialist metadata saw zero founder sessions, session memberships, session events, and guest-session imports. Anonymous remains denied; browser roles have no `network` or `ops` table access. Session content is absent from metadata, analytics URLs, and logs; authenticated pages remain noindex/private/no-store with `Referrer-Policy: no-referrer`.

The master gate was deployed OFF and `/my` returned 404 while both Saved Sessions remained intact, then restored ON and both sessions reappeared. Final state is two sessions, two active session memberships, six session events, two guest-import receipts/items, and zero Watches, Alerts, deliveries, and source observations.

All later-stage flags remain off. Stage 4 requires separate approval and must not infer Watch from Save or session activity.
