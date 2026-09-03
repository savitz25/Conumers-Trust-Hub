# Texas insurance appointment graph (ATH-TX-001)

Checked: 2026-09-03. State level only. No people publication.

## Graph

```
TDI agency (NPN, TDI license)  --appointment-->  insurance company (NAIC)
TDI person (NPN)               --appointment-->  insurance company (NAIC)   [DO NOT PUBLISH]
Title agency (TDI license)     --county+underwriter-->  title underwriter
```

## Live counts

| Dataset | ID | Rows | Identity |
| --- | --- | --- | --- |
| Agencies / businesses | `3yqc-fcdt` | **56,625** license rows; **43,597** unique NPN; **23,004** state=TX | NPN + TDI license |
| Agency appointments | `avjc-7u2m` | **622,019**; **35,168** unique agency NPN; **1,414** unique NAIC | NPN + NAIC + EIN |
| Person appointments | `bupb-23s9` | **4,400,210** | Agent NPN + NAIC — people suppressed |
| Person licenses | `kxv3-diwf` | **962,001** | NPN — people suppressed |
| Surplus lines | `7isd-ex6t` | **18,816** | mixed person/org |
| Title appointments | `y9ze-ft94` | **23,115** | TDI license + underwriter + county |
| Business relationships | `kvqi-vsrr` | **132,253** | NPN / EIN / NAIC |
| Complaints all | `ubdr-4uff` | **305,156** | complaint ≠ violation |
| Complaints one-record | `jjc8-mxkg` | **289,359** | |
| Complaint indexes | `pa9u-9s9w` | **5,966** | company |
| Home/auto rate filings | `iubg-btfs` | **18,001** | company_name + SERFF |
| Authorized companies | TDI reports tool | UNKNOWN | NAIC + TDI EID + phone (described, not counted) |

Old person-appointment id `ft7p-v8a7` returned **HTTP 403**. Current id is `bupb-23s9`.

## Contacts

Agency SODA columns: NPN, license, name, org type, license type, qualification, dates, city, state, zip, title county. **No phone, no email, no street.**

Authorized-company reports are described as including mailing address and phone. Count UNKNOWN until the report is exported. Do not scrape company-profile search.

## Next specialist

`TX-INS-001`: ingest agency roster + agency appointment graph + complaint index + rate filings; export authorized-company list from the official reports tool. Keep person files in a non-public store. No Trust Score.
