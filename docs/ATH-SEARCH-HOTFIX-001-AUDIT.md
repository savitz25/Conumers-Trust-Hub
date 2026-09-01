# ATH-SEARCH-HOTFIX-001 pre-implementation audit

Date: 2026-08-31

## Release baseline

- Ask accepted main: `2841beba6ee7f4c5caad33103c71e717c9016710`
- Ask Production returned HTTP 200 for `/`, `/ask`, `/manage`, and `/claim/continue`.
- Production `/ask?q=auto%20transport%20carrier` rendered the unsupported-result label.
- Accepted homepage fingerprint: `c0a898c5be52197362c6118e9833e1c04c8bd81838ba4e45c2f5a5315353a02f`
- Accepted network-intelligence fingerprint: `834dadcfa800e84914cb0e328f21234f42d7a7314c29d497f801dab2e8d202e1`

## Exact root cause

`isMoveClassQuery` recognizes mover, household-goods, motor-carrier, FMCSA, generic transporter, hauling, and shipment language, but it does not recognize the bounded consumer concepts `auto transport`, `vehicle transport`, or `car shipping`. For `auto transport carrier`, Move classification is therefore false. The remaining word `carrier` correctly activates `isAmbiguousCarrierQuery`, leaving the plan with no selected hub and producing `UNSUPPORTED_QUERY`.

The carrier ambiguity firewall is behaving correctly; the missing domain vocabulary is the defect. The fix must establish explicit vehicle-transport context before role disambiguation without making bare `carrier` a Move term. Explicit insurance context must continue to win.

## Move ownership and release dependency

- Move accepted main at audit: `34113ce1c35333b802a31c4a4fc693083fce4afd`
- `MOVE-DIR-001` is PR #107 and remains open.
- The legacy filtered URL exists in Production, but its source-backed repair is not accepted yet.

Until PR #107 is accepted, Ask will not claim or render an Auto Transport cohort. It will classify the topic and regulatory role, return a useful `HANDOFF`, and link to MoveTrustHub's general public company-research surface. MoveTrustHub remains responsible for qualification, ordering, publication, and evidence semantics.

## Locked boundaries

No Move repository edits, database writes, identity logic, ranking, pricing, service-territory inference, homepage/network count changes, Concierge changes, or customer-platform changes are authorized by this hotfix.
