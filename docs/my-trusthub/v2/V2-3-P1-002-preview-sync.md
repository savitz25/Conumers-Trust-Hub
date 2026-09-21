# P1-002: Move-origin preview reconciliation

PR #189 is updated from `16530b6442b5fb407e69ee07b13b19ae6e26368e` with the exact
PR #185 parent head `16252ef3a6d917bf3bbc0a73282780f750d88232`. The branch update
uses a merge commit to preserve both histories without force-pushing. This is
not a GitHub PR merge. No textual conflict occurred on the fetched revisions.

PR #188's signed-out workspace gate files are unchanged relative to the parent
head. The account contract suite continues to include its three regression tests.

## Move-origin boundary

The original PR accepted every `*.vercel.app` host and accepted localhost in
every environment. This revision limits configuration to:

- Canonical Move production origin (including the existing apex alias).
- Exactly `https://move-trust-fe65g6tam-savitz25-s-projects.vercel.app`.
- Literal localhost or 127.0.0.1 HTTP(S) origins only in explicit
  `NODE_ENV=development`.

Unset/invalid configuration keeps the existing canonical-production behavior.
Comparison occurs before URL normalization can erase a path, dot segment,
backslash, encoded hostname character or credential component. No hostname or
team-suffix wildcard is trusted. User query values never select the origin.
Analytics classifies the configured Move destination by full origin, not hostname
alone. Existing route/query/hash context is retained, and official sources and
other specialist hubs are not retargeted. Public Move API execution is unchanged.

`check:move-origin` runs seven focused tests, including rejected arbitrary Vercel
hosts and path injection, local-development gating, preserved journey/attribution
context, official links, other hubs and analytics scheme/port boundaries. It is
also included in Search Reliability CI. No expected result was weakened.

## Single future environment mutation — NOT PERFORMED

After separate founder approval, set one Ask project variable:

| Setting | Proposed value |
| --- | --- |
| Project | `conumers-trust-hub` |
| Environment | Preview only |
| Git branch | `mth-v2-3-parent-runtime` |
| Name | `NEXT_PUBLIC_MOVE_ORIGIN` |
| Value | `https://move-trust-fe65g6tam-savitz25-s-projects.vercel.app` |

Do not apply to Production, Development or all preview branches. A new approved
preview build is required because `NEXT_PUBLIC_*` is bundled at build time;
already-built immutable deployments will not change. First merge of PR #189
into the preview stack remains a separate approval, and is not performed here.
Removing this one branch override and rebuilding the preview restores canonical
Move links. A future different Move preview must receive an explicit reviewed
allowlist update; changing the environment value alone cannot expand trust.

The reviewed Move preview was verified READY for
`c334a8f30e91a014eaf1226510647f00d4b3db79`. Current parent preview
`conumers-trust-cc98d4fwp-savitz25-s-projects.vercel.app` was verified READY for
`16252ef3a6d917bf3bbc0a73282780f750d88232`.

Without that future environment change, a READY PR preview still uses canonical
production Move links by design. It does not prove isolated cross-domain Save.
No Vercel environment update, production deployment, main update, PR #185/#189
merge, Auth policy change, Project or Move binding creation is part of this patch.
