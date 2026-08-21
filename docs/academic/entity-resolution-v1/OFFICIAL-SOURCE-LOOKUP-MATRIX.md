# Official source lookup matrix (ER workbench)

No undocumented query parameters. FMCSA SMS Overview is **not** used (unreliable). Google is not used.

| system | Official source | Deepest stable URL | Identifier | Reviewer action |
|--------|-----------------|--------------------|------------|-----------------|
| fmcsa_li | FMCSA SAFER Carrier Snapshot | `https://safer.fmcsa.dot.gov/query.asp?...&query_param=USDOT&query_string={USDOT}` | USDOT | DIRECT_RECORD |
| move_existing_profile | FMCSA SAFER search home | `https://safer.fmcsa.dot.gov/` | none frozen | SEARCH + copy legal name. **No second USDOT.** |
| ca_cslb | CSLB Instant License Check | `LicenseDetail.aspx?LicNum={n}` | CSLB license number | DIRECT_RECORD (live site may be on DCA maintenance; frozen snapshot still usable) |
| az_roc | AZ ROC contractor search | `https://azroc.my.site.com/AZRoc/s/contractor-search` | ROC license no. | SEARCH + copy identifier |
| ct_dcp | CT eLicense | `https://www.elicense.ct.gov/` | credential | SEARCH + copy identifier |
| id_dopl | ID DOPL public search | `https://edopl.idaho.gov/OnlineServices/?link=PubSearch` | license | SEARCH + copy identifier |
| mn_dli | MN DLI lookup | `https://secure.doli.state.mn.us/lookup/licensing.aspx` | license | SEARCH + copy identifier |
| nj_dca | NJ MyLicense verification | `https://newjersey.mylicense.com/verification` | registration/license | SEARCH + copy identifier |
| nv_nscb | NV NSCB license search | NSCB ContractorLicenseSearch | license | SEARCH + copy identifier |
| ok_cib | OK CIB “are they licensed” | `https://oklahoma.gov/cib/consumers/are-they-licensed.html` | license | SEARCH + copy identifier |
| tn_blc | TN Commerce search | `https://search.cloud.commerce.tn.gov/` | license | SEARCH + copy identifier |
| va_dpor | VA DPOR | `https://www.dpor.virginia.gov/` | license | SEARCH + copy identifier |

FROZEN official-source snapshot is always shown from candidate/training fields. Live buttons may fail independently (government outage ≠ workbench defect).
