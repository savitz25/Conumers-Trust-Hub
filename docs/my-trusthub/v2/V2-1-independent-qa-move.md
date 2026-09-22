# V2-1 independent Move preview QA — Builder 4

Checked 2026-09-19. Verdict: **PENDING — protected preview prevents independent journey execution**.

- PR: https://github.com/savitz25/Move-trust-Hub/pull/156
- Exact reviewed head: `db6d640398ee622d0c3153e968ce14d621ec744a`.
- Immutable preview: https://move-trust-odhhmm9me-savitz25-s-projects.vercel.app
- Deployment: `dpl_AvXCCeZVLwKjcrTzKBoPygXyQqCY`.
- Vercel read-only deployment evidence: READY, nonproduction preview target, commit equals reviewed head, branch `mth-v2-1-move-save-b3`.
- Sources inspected independently: PR body/comments, exact-head Builder 3 handoff, changed-file list and relevant Save patch. No changes to Builder 3 runtime/worktree.
- Backend classification: **NOT VERIFIED**. A preview target does not establish database isolation.

## Independent reproduction

Fresh browser session → preview `/companies/allied-van-lines` → Vercel Login instead of the Move profile. No credentials, protection bypass, login form submission, Auth emails or database actions attempted. Full login URLs and nonce/auth material are intentionally omitted.

Expected for QA: reviewed profile accessible for safe anonymous local Save testing. Observed: deployment protection prevents reaching the page. This is an access dependency, not evidence that the Save patch is defective.

| Check | Independent result |
| --- | --- |
| QA-01 early Save before old deferral | NOT RUN — protected preview |
| QA-02 one local entry survives reload | NOT RUN |
| QA-03 rapid duplicate activation | NOT RUN |
| QA-04 delayed load not disabled/no-op | NOT RUN |
| QA-05 navigation saves correct entity | NOT RUN |
| QA-06 keyboard/focus/status at 1440/390/320 | NOT RUN |
| QA-07 no false cloud claim/signup bypass/Watch/account creation | Patch reviewed; browser behavior NOT RUN |
| QA-08 authenticated safe nonproduction behavior | NOT RUN — safe isolated backend/account unavailable |

No reproducible runtime defect established. Re-test the same exact preview after an existing authorized access path is available; if the head changes, verify the new immutable deployment first. Builder 3's own results are not independent PASS evidence. Legacy/local Save is not parent My TrustHub synchronization.

Insurance and Lender: bounded open V2 PR searches returned no available handoff/preview. Both PENDING; no tests or runtime edits. The three-hub obligation remains open and does not block delivery of Ask code preparation.
