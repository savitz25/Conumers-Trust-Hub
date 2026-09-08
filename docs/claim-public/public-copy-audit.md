# ATH-CLAIM-PUBLIC-001 public-copy audit

Reviewed 2026-09-07. Counsel review is recommended before broader outreach. This is product/policy alignment, not legal advice.

| Surface | Route/source | Risk found | Action | Final contract |
|---|---|---|---|---|
| Claim meaning | `/claim/continue` | Correct but duplicated | Bound to canonical contract and linked explainer | Management access, never endorsement |
| Claim explainer | `/claim/what-claiming-means` | Missing | Added indexable public page | Does/does-not/free/authority/capability boundaries |
| Claim help | `/claim/help` | Sensitive-email warning incomplete | Expanded safe-support warning | Support does not bypass security |
| Revenue | `/how-we-make-money`, `lib/content.ts` | Future lead-product and score language | Removed; described controlled rollout and optional software | Software never buys influence |
| Independence | `/promise` | Historical score/badge framing | Reframed around evidence, research, and claiming | No claimed quality badge |
| Operator story | `/who-we-are` | Business participation absent | Added participation/editorial boundary | We cite. You decide. |
| Privacy | `/privacy` | Did not cover account platform | Rewritten for accounts, claims, orgs, grants, workflows, mail, audit, analytics | Account data is distinct from public evidence |
| Terms | `/terms` | Historical Trust Score framing | Reframed around evidence, findings, and claimed-profile non-endorsement | Commercial relationships cannot alter research |
| Corrections | `/corrections` | Non-claim/pay boundary implicit | Made explicit | Anyone may report; submission is not removal |
| My Trust Hub | `/manage` | Business context strong; personal context not linked | Added Personal / research link | One account, two clear contexts |
| Team roles | organization UI | Billing offered before a paid product | Hidden for new/change selection; historical value renders | Owner, Manager, Staff V1 surface |
| SEO/robots | sitemap/robots | Parent `/claim` block prevented explainer indexing | Narrowed private route exclusions and added explainer sitemap entry | Public explainer indexed; private routes excluded |

## Repository scan disposition

“Trust Score” and “good standing” remain in source-native semantic guardrails, research explanations that explicitly say no such network score exists, tests, and internal documentation. They are not used as a claimed-business benefit. “Billing” remains in the database/type contracts and tests for historical compatibility, but is absent from new V1 role controls. Prohibited lead-sale phrases remain only in audit/test prohibition lists.
