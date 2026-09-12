# TH-SEARCH-R1-008 evidence

`diagnosis.md` explains the baseline, authoritative boundary, compatibility changes and rollback constraints. `baseline.json`, `before-production.png` and `red-before.log` retain the independent before behavior. `senior-contract-reference.json` and `handoff-contract.json` are bounded read-only upstream checks. Counts are observations for those source releases, never production constants.

Run `npm run check:th-search-r1-008` for the deterministic behavioral gate. `mutation-check.mjs` temporarily changes exact anchors, runs the relevant tests, restores bytes in finally, and records detected regressions. It is an explicit local sensitivity check, not normal CI. Run it only in an isolated clean ticket worktree, then rerun the focused gate.

Browser automation uses the installed agent-browser/Playwright tooling, not a new application dependency. Open a ticket-owned browser and supply `R8_CDP_PORT` and `R8_PLAYWRIGHT_MODULE` (the installed playwright-core module path). `node browser-check.mjs <base-origin> <evidence-prefix>` runs bounded real public-source flows. Run from repository root with the script's full relative path. `browser-fixtures.mjs` runs ONLY against localhost:3108 using actual orchestrator-produced fixture responses: delayed response exclusion, empty versus outage, focus, Back/Forward. It never seeds production.

Browser screenshots and JSON describe actual settled UI. The history regression initially restored the previous result but retained the edited question; `history-red-before.json` records it. Browser navigation now restores the controlled form from URL state. A harness connection timeout and a load-event wait were also encountered; they were not counted as successful checks. Final reports distinguish them from the reproduced application defects.

Validation logs include baseline and candidate results, with unchanged lint warnings. Local telemetry persistence errors reflect intentionally absent operational credentials; no regulatory/account/schema writes or environment changes were performed. Public smokes may emit normal approved search telemetry. Account/claim tests use local fixtures.

Model: GPT-6 Astra / High, USER-CONFIRMED. Review: separate self-review plus automated behavioral/browser checks, not independent human review. Only Ask changed. Senior R1-007 is a read-only contract dependency; Move canonical correction remains pending separate approval.

Vercel Agent Review identified raw browser abort text after the 12-second request deadline. The local browser reproduced it in `timeout-red.json`. `timeout-green.json` verifies the clear timeout message and keyboard retry completing the same scoped public-source request. Run `browser-timeout.mjs red|green` only against localhost:3108; it delays one browser transport, not Production.
