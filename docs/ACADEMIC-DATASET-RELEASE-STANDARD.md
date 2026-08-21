# Academic dataset release standard

**Status:** Architecture and contract only (Academic 001A)  
**Typed registry:** `lib/academic/datasets.ts`  
**Citation template:** `lib/academic/citation.ts`

This standard describes how **future** academic releases should work. It does **not** authorize a production snapshot job, a public download, or a DOI registration.

---

## 1. Longitudinal principle

Public regulatory systems frequently **overwrite** prior state (license status, operating authority, ownership, addresses).

A historical snapshot can become **more valuable with time** because the live system no longer shows what was true on a past date.

Therefore future academic pipelines should:

- preserve historical releases
- never overwrite a published version in place
- treat “latest production extract” as distinct from “citable snapshot”

---

## 2. Required properties of a citable snapshot

Each public or controlled academic release should be:

1. **Immutable** — version `N` does not change after publication
2. **Date-stamped** — snapshot date and release date, both ISO
3. **Reproducible** — documented extract rules, filters, and field mapping
4. **Source-attributed** — original regulator named on every table or file
5. **Accompanied by a schema / data dictionary**
6. **Accompanied by known limitations** (coverage holes, overwrite risk, missingness)
7. **Retained historically** — `v1` remains available after `v2` ships

Access levels (`OPEN` | `CONTROLLED` | `INTERNAL_RESEARCH`) and release statuses (`PLANNED` | `DOCUMENTATION` | `REVIEW` | `PUBLIC` | `CONTROLLED` | `ARCHIVED`) are closed unions in code.

---

## 3. What 001A does **not** do

- No giant production snapshot jobs
- No `downloadHref` populated
- No DOI assigned
- No claim that the live site is a research archive
- No consumer PII in any planned extract

---

## 4. Citation / DOI readiness

Preferred citation shape (template only):

```
TrustHub Research Data. [Dataset Title]. Version X. [Release date]. DOI: [when assigned].
```

Possible later repositories (not registered):

- Zenodo
- Harvard Dataverse
- another appropriate academic archive after counsel review

Cite the **regulator** as the source of the underlying records. Cite TrustHub for the organized snapshot, schema, and documentation.

---

## 5. Counsel items before any public file

Not legal advice. Review with qualified counsel:

| Topic | Why it matters |
|-------|----------------|
| Licensing / redistribution | Many official extracts restrict bulk reuse |
| Source terms | FMCSA, NMLS, CMS, SEC, state boards, DOI/NAIC differ |
| Named businesses | Defamation and interference risk if packaged as accusations |
| Review window | Factual/legal review ≠ veto of unfavorable findings |
| Open vs controlled | Some files may never be open |
| PII / de-identification | Consumer PII is prohibited; business naming still needs a policy |
| IRB | Human-subjects projects (surveys, experiments) |
| FCRA-adjacent use | Especially lending extracts used as eligibility or screening |
| Provenance | Consumers and researchers must still re-check the primary source |

---

## 6. Version numbering (proposed)

Use explicit versions such as `2025.1` or `v1.0.0` tied to a snapshot date. Never reuse a version string for a different extract.

`ARCHIVED` means the file remains citable but is no longer the current recommended vintage.
