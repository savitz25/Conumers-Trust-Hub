# Texas build sequence (ATH-TX-001)

Internal prioritization from **actual** 2026-09-03 evidence. Not a consumer ranking. No Trust Score.

Contractor, Insurance, and Senior were evaluated as likely early priorities. The files do **not** support following a predetermined CA-style order.

## Evaluation

| Hub | Bulk roster? | Exact IDs? | Contacts? | Insurance-on-license? | Ease |
| --- | --- | --- | --- | --- | --- |
| Insurance | Yes — 56,625 agencies + 622k appointments + 305k complaints | NPN, NAIC, TDI license | Weak on SODA (no phone); company report may add phone | Appointments prove producer–company relationship, not consumer policy | **HIGH** |
| Contractor | Partial — trades only; **no GC** | TDLR, TSBPE, CMBL VID | Electrical phones yes; HVAC phones **zero**; CMBL email excellent (vendor) | TSBPE RMP yes; TDLR trades no | **HIGH** for trades, **NONE** for GC universe |
| Senior | **No** TULIP bulk. CCL SODA is daycare. CMS overlay count UNKNOWN | HHSC ID / CMS CCN planned | UNKNOWN on TULIP | n/a | **LOW** |

## Sequence

1. **TX-INS-001** (Builder 3) — TDI agency roster, agency appointment graph, complaint index, rate filings, authorized-company report export. People files stay unpublished.
2. **TX-CON-001** (Builder 4) — Official TDLR electrical/A/C/elevator/appliance CSVs, TSBPE RMP (insurance expiry), CMBL construction-class overlay, TxDOT project overlay as activity. Do not invent a general-contractor list. Do not scrape TCEQ or TDLR enforcement search.
3. Senior is not an early Texas specialist: TULIP is search-only; the easy HHSC SODA file is child care. Do not scrape TULIP.
4. Lender stays thin (SML orders + NMLS search).
5. Move stays search-only for household goods; tow insurance file is a side module.
6. Investor stays search-only until IARD overlay; state-RIA count UNKNOWN.

Public Ask `/texas` is a later network-convergence ticket, after at least one specialist state page exists. This ticket does not create `/texas`.
