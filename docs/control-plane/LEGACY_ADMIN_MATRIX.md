# Legacy Admin Matrix

Audit basis: current origin/main on 2026-09-09 — Ask `17e15a565cf1b467b3a290fc97259ffee7c716c5`, Move `ba72d609a013ed9d432975276f62c85d3e237492`, Insurance `fca65060a9d8c27eae5ab70626ead0716a212dd5`, Lender `0530e3351072d35780e7bd9258372cecf02b24e7`.

| Owner | Surface/capability | Authentication / risk | Ask equivalent | Status | Retirement blocker |
|---|---|---|---|---|---|
| Ask | `/internal/review` and detail | legacy human surface | `/admin/operations/claims` | SAFE_TO_RETIRE (redirected) | none; machine APIs retained |
| Ask | `/internal/record-issues` and detail | legacy human surface | `/admin/operations/corrections` | SAFE_TO_RETIRE (redirected) | machine/domain APIs retained |
| Ask | `/internal/business-replies` and detail | legacy human surface | `/admin/operations/business-responses` | SAFE_TO_RETIRE (redirected) | machine/domain APIs retained |
| Ask | `/internal/launch-ops` | legacy human dashboard | Founder Control Center | SAFE_TO_RETIRE (redirected) | none |
| Ask | customer/email/foundation/experience fixtures and previews | environment gates; synthetic | CI/preview fixtures | QA_ONLY | retain while CI/acceptance depends on them |
| Ask | `/internal/customer-email-qa` | fixed synthetic recipient plus staff/environment gates | none | QA_ONLY | named-admin conversion remains future hardening |
| Ask | handoff mint and launch fixture APIs | scoped session/environment confirmation | no human Admin equivalent | MACHINE_ONLY | test and handoff dependencies |
| Move | FMCSA, BBB, My Move users, portal claims/disputes, quotes, reviews, suggestions | independent shared-secret specialist Admin | aggregate directory only | RETAINED_LEGACY | provider MFA/step-up and per-operation migration |
| Move | legacy lender/insurance namespaces still present in Move | independent shared-secret specialist Admin | none | RETAINED_LEGACY | ownership/dependency audit |
| Insurance | enrichment, leads, license backfill, listing requests, providers, reviews | independent shared-secret specialist Admin | aggregate directory only | RETAINED_LEGACY | provider MFA/step-up and per-operation migration |
| Lender | limited Admin login/server tools | independent shared-secret specialist Admin | directory entry | RETAINED_LEGACY | named specialist authorization |
| Contractor | no broad human Admin | scoped machine/customer contracts | Ask claim/data operations | MACHINE_ONLY | no migration required |
| Senior | research/handoff internals | machine/internal | Ask claim/data operations | MACHINE_ONLY | no human surface found |
| Investor | SEC/SEO/handoff gates | machine/internal | Ask claim/data operations | MACHINE_ONLY | no human surface found |

`/admin/legacy` is a read-only directory. Queue values remain `NOT_INSTRUMENTED` until a bounded authenticated adapter exists; missing adapters are never displayed as zero. Ask stores no specialist Admin secret and infers no specialist write permission from `ADMIN_VIEW`.
