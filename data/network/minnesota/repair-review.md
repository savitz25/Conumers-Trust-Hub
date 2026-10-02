# ATH-MN-001R routing repair

Reviewed parent: `74d0b55e715be764091ec55bf10093f73c5cedc9`.
Pinned baseline: `b34b2b4a81cf42ddfc890f37c02c703285d47a22`.

The Minnesota geography gate now precedes its ambiguous-number refusal. Ranking already checks Minnesota context and is unchanged. Generic numeric input continues through the existing network planner.

Regression evidence: the three generic forms (`2229`, `license 2229`, `credential 2229`) and the generic route-copy assertion failed before the fix. All pass after it. The entire generic `2229` route object equals pinned baseline, excluding nondeterministic timings: identity-needed intent, generic clarification, no Minnesota geography or NMLS guidance. Tennessee/Florida forms are not intercepted; Minnesota forms remain fail-closed.

Matrix: original 203 plus 12 refusal-scope cases = 215; full Minnesota suite 221/221. Existing identifier, ranking, collision, Florida and prior-state cases all pass.

Recomputed canonical publication fingerprint: `4baa31da936a1270d9606ce8647c88180aa0c5cecfa4f701f85e7b21829eee58`. The canonical algorithm hashes the publication manifest, not implementation source or test matrices; its input is unchanged. All six specialist pairs, independent clocks and federation invariants remain unchanged.

Preview acceptance uses official temporary Vercel share access for the new exact head. Raw preview protection must remain Vercel SSO; no protection-setting changes are authorized or needed. Production must remain publicly accessible after any separately authorized merge. Exact-head CI, Agent Review and hosted QA results are recorded in PR #215 after push; this file does not certify a future deployment.

The broad sweep has known baseline/environment failures and must not be represented as wholly green. Independent A-B1 review is required. Do not merge.

Validation: npm test 740/740; typecheck exit 0; production build exit 0. Broad sweep candidate 1070/1081, pinned base 849/860: the same 11 failure names and assertion messages (8 live Insurance cases and 3 historical static assertions), no candidate-only failures. See repair-baseline-comparison.json.
`npm run lint`: exit 0, zero errors and 9 existing warnings.
