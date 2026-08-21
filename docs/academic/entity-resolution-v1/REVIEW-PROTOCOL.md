# ER V1 review protocol (for Academic 001C.2)

Reviews are performed by **humans** in 001C.2B using the local workbench (`docs/ACADEMIC-001C2A-HUMAN-REVIEW-WORKBENCH.md`). 001C.2A does not assign labels.

## Independent dual review

Reviewer A and Reviewer B receive separate packets (`reviewer-a.csv`, `reviewer-b.csv`).

Neither reviewer sees:

- the other reviewer’s label
- an adjudicated label
- model confidence as a conclusion
- automatic proposed MATCH/NON_MATCH
- Move 008b resolution / Contractor linker confidence

They see identity fields and `review_source_hints`. `candidate_reason` is marked **NON_EVIDENCE**.

Blank fields they fill: `review_label`, `review_notes`, `evidence_checked`, `reviewed_at`.

## Allowed labels

`MATCH` | `NON_MATCH` | `AMBIGUOUS`  
Do not invent `PROBABLE_MATCH`.

### MATCH

Authoritative evidence that both records refer to the **same** regulated business for the question, for example:

- same official regulator identifier (same USDOT; same board license key)
- official DBA link on the same regulator record
- official filing connecting the two names
- official cross-reference or documented successor/predecessor
- multiple mutually reinforcing official fields after manual inspection of primary sources

### NON_MATCH

Authoritative evidence of **distinct** entities, for example:

- different regulator identifiers **plus** official evidence they are separate businesses
- conflicting official identities that cannot be reconciled
- official records showing distinct operators

### AMBIGUOUS

Incomplete, conflicting, or insufficient official evidence. Reviewers **must not** be forced to a binary answer.

## Insufficient on their own

- Name similarity  
- Address similarity  
- Phone similarity  
- Google / commercial enrichment (**not used**)  
- FMCSA SMS Overview pages (unreliable; use SAFER)  
- TrustHub confidence, `review_required`, heuristics, automated linker output  

## Adjudication (001C.2)

If A and B agree → `AGREED` pending QA.  
If they disagree → independent adjudicator chooses MATCH, NON_MATCH, or AMBIGUOUS and records reason plus evidence classes.

Record later: raw agreement, Cohen’s kappa, counts by label/difficulty/type/vertical, adjudication rate. Do not compute those until labels exist.

## Reviewer identity

Do not publish reviewer names.
