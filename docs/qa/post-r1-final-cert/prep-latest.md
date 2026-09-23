# Post-R1 cross-hub certification -- prep run

- Ask HEAD: `06a4c614db32348869a5d9c5bd255e2b54aa97a9`
- Mode: **prep** (prep -- nothing is certified GREEN by this run)
- Started: 2026-09-23T01:15:50.893Z
- Result: PASS 24 / KNOWN_LIMITATION 0 / PENDING_RELEASE 4 / FAIL 0

## Six-hub matrix

| Hub | Specialist | Ask routing | Identity | Local / geography | Handoff | Known limitations | Pending releases | Verdict |
|---|---|---|---|---|---|---|---|---|
| MOVE | RESPONDING | CORRECT | PASS (MOV-01:SOURCE_BACKED_RESULT; MOV-03:SOURCE_BACKED_RESULT) | PASS (MOV-02:SOURCE_BACKED_RESULT) | SAFE (allowlisted https, query context preserved) | - | - | **NOT CERTIFIED (prep run; would be GREEN)** |
| LENDER | RESPONDING | CORRECT | PASS (LEN-01:SOURCE_BACKED_RESULT) | PASS (LEN-02:HONEST_UNSUPPORTED_WITH_NEXT_ACTION; LEN-03:SOURCE_BACKED_RESULT) | SAFE (allowlisted https, query context preserved) | - | - | **NOT CERTIFIED (prep run; would be GREEN)** |
| INSURANCE | RESPONDING | CORRECT | NOT_EXERCISED | PASS (INS-01:HONEST_UNSUPPORTED_WITH_NEXT_ACTION; INS-02:SOURCE_BACKED_RESULT; INS-03:HONEST_UNSUPPORTED_WITH_NEXT_ACTION) | SAFE (allowlisted https, query context preserved) | INSURANCE_JACKSONVILLE_CROSSWALK_GAP | - | **NOT CERTIFIED (prep run; would be GREEN)** |
| CONTRACTOR | TIMEOUT on CON-01,CON-02,CON-03,CON-04 | CORRECT | PENDING_RELEASE (CON-04:TECHNICAL_TIMEOUT) | PENDING_RELEASE (CON-01:TECHNICAL_TIMEOUT; CON-02:TECHNICAL_TIMEOUT; CON-03:TECHNICAL_TIMEOUT; CON-05:HONEST_UNSUPPORTED_WITH_NEXT_ACTION) | SAFE (allowlisted https, query context preserved) | CONTRACTOR_IDENTIFIER_TIMEOUT_FOLLOWUP, FL_ELECTRICAL_SOURCE_GAP | CONTRACTOR_COLD_PATH_STABILIZATION | **NOT CERTIFIED (prep run; would be BLOCKED)** |
| SENIOR | RESPONDING | CORRECT | PASS (SEN-01:DETERMINISTIC_CLARIFICATION) | PASS (SEN-02:SOURCE_BACKED_RESULT; SEN-05:HONEST_UNSUPPORTED_WITH_NEXT_ACTION) | SAFE (allowlisted https, query context preserved) | CMS_MEMORY_CARE_ASSISTED_LIVING_SOURCE_GAP, HOME_HEALTH_COUNTY_SERVICE_AREA, AVANTE_SIX_CHARACTER_AMBIGUITY | - | **NOT CERTIFIED (prep run; would be GREEN)** |
| INVESTOR | RESPONDING | CORRECT | PASS (INV-01:SOURCE_BACKED_RESULT; INV-02:SOURCE_BACKED_RESULT) | PASS (INV-03:SOURCE_BACKED_RESULT) | SAFE (allowlisted https, query context preserved) | - | - | **NOT CERTIFIED (prep run; would be GREEN)** |

## Per-query records

| ID | Query | Surface | Vertical | Entity | Identifier | Product/class | Geography (requested -> executed) | Capability | Result state | Outcome class | Next actions | Failure | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| LEN-01 | is rocket mortgage legit | GUIDED | lender | rocket mortgage | - | entityClass=hmda_reporting_institution researchMode=identity_name | - -> - | guided:lender:identity_name | EXACT_IDENTITY/ROWS | SOURCE_BACKED_RESULT | OPEN_TRUSTHUB_DESTINATION, OPEN_TRUSTHUB_DESTINATION | - | **PASS** |
| LEN-02 | banks that do helocs in ohio | GUIDED | lender | - | - | - | Ohio -> Ohio | guided:lender | -/NONE | HONEST_UNSUPPORTED_WITH_NEXT_ACTION | - | - | **PASS** |
| LEN-03 | va loan lenders near fort bragg nc | GUIDED | lender | - | - | loanType=VA entityClass=hmda_reporting_institution researchMode=property_market | Fayetteville (Fort Bragg / Fort Liberty), North Carolina -> North Carolina | guided:lender:property_market | SUPPORTED_RESULTS/ROWS | SOURCE_BACKED_RESULT | CONSENT_BROADENING, OPEN_TRUSTHUB_DESTINATION | - | **PASS** |
| INS-01 | insurance agent in miami | GUIDED | insurance | - | - | insuranceEntityClass=producer entityClass=producer researchMode=local_directory_handoff | Miami, Florida -> - | guided:insurance:local_directory_handoff | UNSUPPORTED_CAPABILITY/ZERO | HONEST_UNSUPPORTED_WITH_NEXT_ACTION | CONSENT_BROADENING | unsupported (zip_directory_not_supported) | **PASS** |
| INS-02 | insurance agency in broward county | GUIDED | insurance | - | - | insuranceEntityClass=agency entityClass=agency researchMode=local_directory_handoff | Broward County, Florida -> - | guided:insurance:local_directory_handoff | SUPPORTED_RESULTS/ROWS | SOURCE_BACKED_RESULT | CONSENT_BROADENING, OPEN_TRUSTHUB_DESTINATION | - | **PASS** |
| INS-03 | medicare supplement agent in ohio | GUIDED | insurance | - | - | - | Ohio -> Ohio | guided:insurance | -/NONE | HONEST_UNSUPPORTED_WITH_NEXT_ACTION | - | - | **PASS** |
| INS-04 | is state farm licensed in texas | GUIDED | - | - | - | - | Texas -> - | guided:multi-hub | -/NONE | DETERMINISTIC_CLARIFICATION | hub:contractor, hub:lender, hub:insurance, hub:move | - | **PASS** |
| CON-01 | general contractor in miami | GUIDED | contractor | - | - | trade=general entityClass=credential_record | Miami, Florida -> Miami-Dade County, Florida | guided:contractor:general | TIMEOUT/ZERO | TECHNICAL_TIMEOUT | RETRY, OPEN_TRUSTHUB_DESTINATION, OPEN_TRUSTHUB_DESTINATION | timeout (timeout) | **PENDING_RELEASE** |
| CON-02 | roofers in broward | GUIDED | contractor | - | - | trade=roofing entityClass=credential_record | Broward County, Florida -> Broward County, Florida | guided:contractor:roofing | TIMEOUT/ZERO | TECHNICAL_TIMEOUT | RETRY, OPEN_TRUSTHUB_DESTINATION, OPEN_TRUSTHUB_DESTINATION | timeout (timeout) | **PENDING_RELEASE** |
| CON-03 | plumber in miami | GUIDED | contractor | - | - | trade=plumbing entityClass=credential_record | Miami, Florida -> Miami-Dade County, Florida | guided:contractor:plumbing | TIMEOUT/ZERO | TECHNICAL_TIMEOUT | RETRY, OPEN_TRUSTHUB_DESTINATION, OPEN_TRUSTHUB_DESTINATION | timeout (timeout) | **PENDING_RELEASE** |
| CON-04 | verify contractor license CBC015082 | GUIDED | contractor | - | state_contractor_license:CBC015082 | entityClass=credential_record | - -> - | guided:contractor | TIMEOUT/ZERO | TECHNICAL_TIMEOUT | RETRY, OPEN_TRUSTHUB_DESTINATION, OPEN_TRUSTHUB_DESTINATION | timeout (timeout) | **PENDING_RELEASE** |
| CON-05 | licensed electrician in boca raton | GUIDED | contractor | - | - | trade=electrical entityClass=credential_record | Boca Raton, Florida -> Palm Beach County, Florida | guided:contractor:electrical | UNSUPPORTED_TRADE_CAPABILITY/ZERO | HONEST_UNSUPPORTED_WITH_NEXT_ACTION | OPEN_TRUSTHUB_DESTINATION, OPEN_TRUSTHUB_DESTINATION, OPEN_TRUSTHUB_DESTINATION | unsupported (unsupported_florida_electrical_source) | **PASS** |
| SEN-01 | is abbey delray south medicare certified | GUIDED | senior | abbey delray south | - | - | - -> - | guided:senior | -/NONE | DETERMINISTIC_CLARIFICATION | nursing_home, home_health, assisted_living, hospice | - | **PASS** |
| SEN-02 | hospice care for my mom in tampa | GUIDED | senior | - | - | providerClass=hospice careSetting=hospice entityClass=hospice | Tampa, Florida -> Tampa, Florida | guided:senior:hospice | SUPPORTED_RESULTS/ROWS | SOURCE_BACKED_RESULT | OPEN_TRUSTHUB_DESTINATION, OPEN_TRUSTHUB_DESTINATION, OPEN_TRUSTHUB_DESTINATION | - | **PASS** |
| SEN-03 | memory care in orlando | GUIDED | senior | - | - | careSetting=memory_care entityClass=memory_care | Orlando, Florida -> - | guided:senior | UNSUPPORTED_CAPABILITY/ZERO | HONEST_UNSUPPORTED_WITH_NEXT_ACTION | OPEN_TRUSTHUB_DESTINATION, OPEN_TRUSTHUB_DESTINATION | unsupported (care_capability_unavailable) | **PASS** |
| SEN-04 | assisted living facilities in new jersey | GUIDED | senior | - | - | careSetting=assisted_living entityClass=assisted_living | NJ -> - | guided:senior | UNSUPPORTED_CAPABILITY/ZERO | HONEST_UNSUPPORTED_WITH_NEXT_ACTION | OPEN_TRUSTHUB_DESTINATION, OPEN_TRUSTHUB_DESTINATION | unsupported (care_capability_unavailable) | **PASS** |
| SEN-05 | home health agencies in miami dade county | GUIDED | senior | - | - | providerClass=home_health careSetting=home_health entityClass=home_health | Miami-Dade County, Florida -> - | guided:senior:home_health | UNSUPPORTED_CAPABILITY/ZERO | HONEST_UNSUPPORTED_WITH_NEXT_ACTION | CONSENT_BROADENING, OPEN_TRUSTHUB_DESTINATION, OPEN_TRUSTHUB_DESTINATION | unsupported (care_capability_unavailable) | **PASS** |
| MOV-01 | Senior Moving Services LLC | NAME_CANDIDATES | move | Senior Moving Services LLC | - | - | - -> - | name-candidates:all | NAME_CANDIDATES/ROWS | SOURCE_BACKED_RESULT | - | - | **PASS** |
| MOV-02 | movers in broward county | GUIDED | move | - | - | moveMode=mover entityClass=mover | Broward County, Florida -> Florida | guided:move:mover | SUPPORTED_RESULTS/ROWS | SOURCE_BACKED_RESULT | CONSENT_BROADENING, OPEN_TRUSTHUB_DESTINATION, OPEN_TRUSTHUB_DESTINATION | - | **PASS** |
| MOV-03 | USDOT 3244649 | GUIDED | move | - | usdot:3244649 | moveMode=identifier entityClass=identifier | - -> - | guided:move:identifier | SUPPORTED_RESULTS/ROWS | SOURCE_BACKED_RESULT | OPEN_TRUSTHUB_DESTINATION, OPEN_TRUSTHUB_DESTINATION, OPEN_OFFICIAL_SOURCE | - | **PASS** |
| INV-01 | Fisher Investments | NAME_CANDIDATES | investor | Fisher Investments | - | - | - -> - | name-candidates:all | NAME_CANDIDATES/ROWS | SOURCE_BACKED_RESULT | - | - | **PASS** |
| INV-02 | CRD 105958 | GUIDED | investor | - | CRD:105958 | investorFirmClass=ria_and_era entityClass=ria_and_era researchMode=identifier | - -> - | guided:investor:identifier | EXACT_IDENTITY/ROWS | SOURCE_BACKED_RESULT | OPEN_TRUSTHUB_DESTINATION, OPEN_TRUSTHUB_DESTINATION, OPEN_OFFICIAL_SOURCE | - | **PASS** |
| INV-03 | investment advisers in california | GUIDED | investor | - | - | investorFirmClass=ria_and_era entityClass=ria_and_era researchMode=firm_cohort | California -> California | guided:investor:firm_cohort | SUPPORTED_RESULTS/ROWS | SOURCE_BACKED_RESULT | OPEN_TRUSTHUB_DESTINATION, OPEN_TRUSTHUB_DESTINATION, OPEN_TRUSTHUB_DESTINATION | - | **PASS** |
| NET-01 | AVANTE | NAME_CANDIDATES | insurance+contractor+investor | AVANTE | - | - | - -> - | name-candidates:all | NAME_CANDIDATES/ROWS | SOURCE_BACKED_RESULT | - | - | **PASS** |
| NET-02 | electrician mortgage lender New Jersey | GUIDED | - | - | - | entityClass=mortgage_lender | New Jersey -> - | guided:multi-hub | -/NONE | DETERMINISTIC_CLARIFICATION | hub:lender, hub:contractor | - | **PASS** |
| NET-03 | NPN 00000001 | GUIDED | insurance | - | NPN:00000001 | insuranceEntityClass=agency entityClass=agency researchMode=identifier | - -> - | guided:insurance:identifier | NO_CONFIDENT_MATCH/ZERO | SOURCE_BACKED_RESULT | OPEN_TRUSTHUB_DESTINATION, OPEN_OFFICIAL_SOURCE, OPEN_TRUSTHUB_DESTINATION | unsupported (no_confident_match) | **PASS** |
| NET-04 | restaurant health inspections in miami | GUIDED | - | - | - | - | Miami, Florida -> - | guided:multi-hub | -/NONE | DETERMINISTIC_CLARIFICATION | hub:contractor, hub:lender, hub:insurance, hub:move | - | **PASS** |
| NET-05 | brightway insurance jacksonville | NAME_CANDIDATES | - | brightway insurance jacksonville | - | - | - -> - | name-candidates:all | NAME_CANDIDATES/ZERO | SOURCE_BACKED_RESULT | - | - | **PASS** |

## Observations (non-gating)

- OBS-01 "I need a mover and a mortgage lender in New Jersey": GUIDED -> BROKEN_HANDOFF -- CLARIFY dead end: no choices, no next action -- "The requested local scope is not executable by this specialist."
- state farm -> insurance -> legal_insurer: deadEnd=true; last step: {"action":"SELECT_CHOICE insurance_class:legal_insurer","ok":true,"hub":"insurance","phase":"CLARIFY","choices":[],"nextActions":[],"nextAction":"The requested scope cannot be executed safely."}

## Multi-hub choice flows

- stateFarmInsurance: sessionValid=true deadEnd=false steps=START=>CLARIFY/multi | SELECT_CHOICE hub:insurance=>CLARIFY/insurance
- stateFarmLegalInsurer: sessionValid=true deadEnd=true steps=START=>CLARIFY/multi | SELECT_CHOICE hub:insurance=>CLARIFY/insurance | SELECT_CHOICE insurance_class:legal_insurer=>CLARIFY/insurance
- electricianLender: sessionValid=true deadEnd=false steps=START=>CLARIFY/multi | SELECT_CHOICE hub:lender=>CLARIFY/lender
- electricianContractor: sessionValid=true deadEnd=false steps=START=>CLARIFY/multi | SELECT_CHOICE hub:contractor=>CLARIFY/contractor
