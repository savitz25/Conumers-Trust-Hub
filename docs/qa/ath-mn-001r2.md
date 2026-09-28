# ATH-MN-001R2: Minnesota ranking refusal

Parent: `9c6cbf6fc140be57e454919754348e7101c81336`.
Pinned base: `b34b2b4a81cf42ddfc890f37c02c703285d47a22`.

Before: `AggregateRating Minnesota contractor` and `most trustworthy Minnesota contractor` both returned no mnRefusal, COHORT_BROWSE / COHORT, executionAllowed true, route.canExecute true and a status permitting specialist research. Two newly added execution regressions failed on the parent.

After: both return MN_RANKING_REFUSAL, RECOMMENDATION_REQUEST / CLARIFY, executionAllowed false and route.canExecute false. The only product-code change expands the existing case-insensitive ranking matcher, retaining queryLooksLikeMinnesota as its scope gate. The accepted bare-number guard is unchanged.

Matrix: previous 215 cases plus 102 vocabulary/provider combinations (17 phrases across six provider types, alternating case), four exact reported wording cases, six ordinary-research controls and 34 non-Minnesota controls = 361 cases. Including six existing release/integration checks, the Minnesota suite passes 367/367. Each ranking combination checks the planner, route execution gate, no name search and no executable hub options. Normal research remains unchanged; assisted living retains its existing separate care-scope route restriction and is not classified as ranking.

No data or manifest edits. Six certified SHA/fingerprint pairs, clocks, safe grains and all federation invariants remain unchanged. Recomputed publication fingerprint: `4baa31da936a1270d9606ce8647c88180aa0c5cecfa4f701f85e7b21829eee58`. The canonical input is the unchanged publication manifest.

Exact-head CI, Vercel Agent Review and official share-access preview results are recorded in PR #215 after push. Raw Preview remains intentionally protected by Vercel SSO. No merge is authorized; A-B1 must independently review the new head.

Validation: full npm test 886/886, golden semantic corpus 10/10, typecheck exit 0, lint exit 0 (9 existing warnings), production build exit 0.

Broad sweep: {"r2-broad-recheck": {"tests": 1227, "pass": 1216, "fail": 11}, "r2-base-broad": {"tests": 860, "pass": 849, "fail": 11}}. The same 11 failure names and assertion messages match pinned base exactly; no candidate-only failures remain. The initial concurrent sweep also hit the 5ms cohort p95 threshold at 7.74ms; targeted rerun passed 7/7 and the full broad rerun passed that test after build completed. This transient timing failure is disclosed, not hidden. The broad sweep remains non-green.

```json
{
  "lib\\guided-research\\th-discovery-001-corpus.test.ts:199:1": " [ERR_ASSERTION]: a genuine local-directory search must either succeed or honestly report a backend failure, never a fabricated result (got UNSUPPORTED_CAPABILITY)",
  "lib\\guided-research\\th-discovery-002-corpus.test.ts:124:1": " [ERR_ASSERTION]: Expected values to be strictly equal:\n  + actual - expected\n  \n  + 'UNSUPPORTED_CAPABILITY'\n  - 'SUPPORTED_RESULTS'\n  ",
  "lib\\guided-research\\th-discovery-002-corpus.test.ts:134:1": " [ERR_ASSERTION]: Expected values to be strictly equal:\n  + actual - expected\n  \n  + 'UNSUPPORTED_CAPABILITY'\n  - 'SUPPORTED_RESULTS'\n  ",
  "lib\\guided-research\\th-discovery-002-corpus.test.ts:148:1": " [ERR_ASSERTION]: Expected values to be strictly equal:\n  + actual - expected\n  \n  + 'SUPPORTED_RESULTS'\n  - 'UNSUPPORTED_CAPABILITY'\n  ",
  "lib\\guided-research\\th-discovery-002-corpus.test.ts:165:1": " [ERR_ASSERTION]: Expected values to be strictly equal:\n  + actual - expected\n  \n  + 'SUPPORTED_RESULTS'\n  - 'PUBLICATION_RESTRICTED'\n  ",
  "lib\\guided-research\\th-discovery-002b-corpus.test.ts:36:1": " [ERR_ASSERTION]: Expected values to be strictly equal:\n  + actual - expected\n  \n  + 'UNSUPPORTED_CAPABILITY'\n  - 'SUPPORTED_RESULTS'\n  ",
  "lib\\guided-research\\th-discovery-002b-corpus.test.ts:47:1": " [ERR_ASSERTION]: Expected values to be strictly equal:\n  + actual - expected\n  \n  + 'UNSUPPORTED_CAPABILITY'\n  - 'SUPPORTED_RESULTS'\n  ",
  "lib\\guided-research\\th-discovery-002b-corpus.test.ts:60:1": " [ERR_ASSERTION]: Expected values to be strictly equal:\n  + actual - expected\n  \n  + 'UNSUPPORTED_CAPABILITY'\n  - 'SUPPORTED_RESULTS'\n  ",
  "lib\\network\\ath-search-hotfix-001.test.ts:117:1": " [ERR_ASSERTION]: Expected values to be strictly equal:\n  + actual - expected\n  \n  + '13d732611c16eb244167e10fa28af4541101901c79e907e8a151199a56679d97'\n  - 'c0a898c5be52197362c6118e9833e1c04c8bd81838ba4e45c2f5a5315353a02f'\n  ",
  "lib\\network\\prompt-1.test.ts:53:1": " [ERR_ASSERTION]: The expression evaluated to a falsy value:\n  \n    assert.ok(!live.includes('nmls'))\n  ",
  "lib\\network\\th-search-network-cert.test.ts:36:1": " [ERR_ASSERTION]: Expected values to be strictly deep-equal:\n  + actual - expected\n  \n    [\n      'q',\n  +   'class',\n  +   'state'\n    ]\n  "
}
```
