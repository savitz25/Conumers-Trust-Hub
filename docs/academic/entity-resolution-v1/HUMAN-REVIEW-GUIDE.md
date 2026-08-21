# Human review guide — TrustHub Entity Resolution Benchmark

For people labeling cases. You do not need to know how TrustHub is built.

This is an **internal** process. It is not a university course and not a public dataset.

---

## Purpose

Decide whether two public regulatory records refer to the **same regulated business** for this identity question.

You will see Record A and Record B. Judge from **official government sources**, not from how similar the names look.

**Similarity is not ground truth.**

---

## What “identity” means here

The unit is a **business/entity in a public registry** (FMCSA household-goods carrier/broker, or a state contractor license), not a consumer, not an employee, not a Google listing.

---

## Labels (choose exactly one)

**MATCH**  
Authoritative public evidence supports that Record A and Record B represent the same underlying regulated business/entity for this identity question.

**NON_MATCH**  
Authoritative public evidence supports that they are distinct regulated businesses/entities.

**AMBIGUOUS**  
The available authoritative public evidence is insufficient, conflicting, or does not support a defensible binary conclusion.

Do not use PROBABLE_MATCH. If you are not sure, use AMBIGUOUS.

---

## Evidence hierarchy (use these)

1. Official regulator identifier (USDOT, board license key)
2. Official regulator legal name / DBA on that record
3. Official state board record
4. Official regulatory cross-reference
5. Official registered address or filing evidence
6. Other authoritative public **government** evidence

## Do not use

Google Places, Google Reviews, Yelp, BBB, social media, commercial people-search, or company aggregators.

Name similarity, address similarity, or a shared phone **alone** is not enough for MATCH or NON_MATCH.

---

## Examples of sufficient evidence (generic)

- Same official USDOT on both records after you open FMCSA SAFER.  
- Same official board license number after you open the board lookup.  
- An official DBA field on the **same** regulator record connecting the two names.

## Examples of insufficient evidence

- “They sound like the same moving company.”  
- Same street or building, different license names.  
- Franchise/van-line branding with different USDOTs.  
- Same trade name in two states with no official entity key.  
- A TrustHub queue reason, confidence score, or case construction hint (you should not see those).

---

## FMCSA lookup

If a record has a numeric USDOT, open the SAFER snapshot link in the workbench (or search [SAFER](https://safer.fmcsa.dot.gov/) by USDOT). Confirm legal name, DBA, location, and MC if present.

If Record B is `move-profile:…` **no second USDOT was frozen**. Search SAFER by the displayed legal name. **Do not invent a USDOT.** If you cannot find an official counterpart, AMBIGUOUS is appropriate.

---

## Contractor board lookup

Use the official board link shown for that source (CSLB, AZ ROC, NJ MyLicense, NV NSCB, OK CIB, TN Commerce, ID DOPL, MN DLI, VA DPOR, CT eLicense). Search the license/external identifier.

Do not use unofficial contractor directories as evidence.

---

## How to document evidence

In **evidence checked**, list the official pages/tools you actually opened (USDOT, license number, board name).

In **notes**, say which official fields supported your label and why you rejected the others. Keep notes factual.

---

## Using AMBIGUOUS correctly

Use it when official records are missing, conflict, or do not settle the question. It is a valid benchmark outcome, not a failure.

---

## Independence

If you are Reviewer A, do not look at Reviewer B’s labels, notes, or files. Do not discuss the frozen 400 cases with the other reviewer.

You **may** discuss protocol definitions after both of you finish the **training** set only.

Attest, when you lock:

> I reviewed these cases using the TrustHub Entity Resolution Benchmark review protocol and did not use an automatic proposed benchmark label.
