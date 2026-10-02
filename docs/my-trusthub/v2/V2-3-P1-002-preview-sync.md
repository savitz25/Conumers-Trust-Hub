# P1-002: Move-origin preview reconciliation

PR #189 is updated from `16530b6442b5fb407e69ee07b13b19ae6e26368e` with the exact
PR #185 parent head `16252ef3a6d917bf3bbc0a73282780f750d88232`. The branch update
uses a merge commit to preserve both histories without force-pushing. This is
not a GitHub PR merge. No textual conflict occurred on the fetched revisions.

PR #188's signed-out workspace gate files are unchanged relative to the parent
head. The account contract suite continues to include its three regression tests.

## Move-origin boundary

The original PR accepted every `*.vercel.app` host and accepted localhost in
every environment. A follow-up then pinned one deployment host. That pin is
what made a later Move preview (`move-trust-hg9c479w8-…`) fall back to
`https://www.movetrusthub.com` even when `NEXT_PUBLIC_MOVE_ORIGIN` was set.
Current configuration accepts:

- Canonical Move production origin (including the existing apex alias).
- HTTPS origins matching
  `https://move-trust-<deployment>-savitz25-s-projects.vercel.app`, including
  `https://move-trust-hg9c479w8-savitz25-s-projects.vercel.app` and earlier
  reviewed deployment hosts on the same Move project.
- Literal localhost or 127.0.0.1 HTTP(S) origins only in explicit
  `NODE_ENV=development`.

Arbitrary `*.vercel.app` hosts, other Vercel teams, paths, credentials, queries,
hashes, and non-HTTPS preview origins stay rejected. Unset/invalid configuration
keeps the canonical production host. Comparison occurs before URL normalization
can erase a path, dot segment, backslash, encoded hostname character or
credential component. User query values never select the origin. Analytics
classifies the configured Move destination by full origin, not hostname alone.
Existing route/query/hash context is retained, and official sources and other
specialist hubs are not retargeted. Public Move API execution is unchanged.
Guided `/ask` profile and next-action hrefs use the same helper.

`check:move-origin` covers rejected arbitrary Vercel hosts and path injection,
this project's deployment-id rotation, local-development gating, preserved
journey/attribution context, movers-in-Florida profile and next-action hrefs,
official links, other hubs and analytics scheme/port boundaries. It is also
included in Search Reliability CI. No expected result was weakened.

## Preview environment

The Ask preview branch already carries one variable. This patch does not change Vercel.

| Setting | Proposed value |
| --- | --- |
| Project | `conumers-trust-hub` |
| Environment | Preview only |
| Git branch | `mth-v2-3-parent-runtime` |
| Name | `NEXT_PUBLIC_MOVE_ORIGIN` |
| Value | `https://move-trust-hg9c479w8-savitz25-s-projects.vercel.app` |

Keep it off Production, Development, and other preview branches. A rebuild is
required after this allowlist change because `NEXT_PUBLIC_*` is bundled at
build time; the current deployment still contains the single-host pin.
Removing the branch override and rebuilding restores canonical Move links. A
later Move deployment on the same
`move-trust-*-savitz25-s-projects.vercel.app` host can be selected by changing
this preview value and rebuilding. Other teams and arbitrary `*.vercel.app`
hosts remain rejected.

The reviewed Move preview was verified READY for
`c334a8f30e91a014eaf1226510647f00d4b3db79`. Current parent preview
`conumers-trust-cc98d4fwp-savitz25-s-projects.vercel.app` was verified READY for
`16252ef3a6d917bf3bbc0a73282780f750d88232`.

With the branch preview variable already set, the next Ask preview rebuild
retargets Move consumer handoffs, including profile and next-action links.
Unset or production values still keep `https://www.movetrusthub.com`. This
patch does not update Vercel, deploy production, update main, merge PR #185 or
#157, or change Auth, Supabase, or public signup.
