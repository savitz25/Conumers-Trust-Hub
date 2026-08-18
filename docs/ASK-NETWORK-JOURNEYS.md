# Ask Trust Hub — Network V2.1 bounded journeys

**Status:** UX/orchestration only. Network V2 chrome is closed.  
**Does not replace:** `docs/ASK-NETWORK-CONTRACT.md`

Contextual handoffs appear only when the next decision follows the same life event.  
Switch Hub remains the general network directory. Do not spray sibling cards.

## Taxonomy (reuse existing IDs)

| Alias | Live `SituationId` | Params | Primary | Conditional |
|-------|--------------------|--------|---------|-------------|
| `home_buy` | `buy_local` | `src=ask&journey=purchase&intent=buy` | Lender | Insurance; Move only if relocating; Contractor only if a home project is indicated |
| `move_buy` | `move_buy` | `src=ask&journey=relocate&intent=buy` | Move | Lender, then Insurance |
| `move_rent` | `move_rent` | `src=ask&journey=relocate&intent=rent` | Move | Insurance (no mortgage) |
| `coverage_after_move` | `coverage_after_move` | `src=ask&journey=coverage` | Insurance | Move if logistics remain open |
| `home_project_after_purchase` | `hire_contractor` | `src=ask&journey=contractor` | Contractor | Insurance only when the project has coverage implications |
| senior transition | `aging_parent` | `src=ask&journey=senior_care` | Senior | Move / Contractor / Insurance only when that next decision is real |
| investment firm | `investing_research` | `src=ask&journey=investing` | Investor | **none** in V2.1 |

## Safe query keys

`src` `journey` `state` `county` `intent` `housing`

Never: name, email, phone, street address, SSN, member ID, diagnosis, holdings, account IDs.

Journey parameters are navigation context. They must not become sitemap or indexable landing pages.

## Journey analytics contract

**Event:** `journey_handoff_click`

Click-only. No impression events in V2.1.1.

Best-effort. Navigation must not wait on analytics. Do not pass visitor IDs or stitch cross-domain identity.

### Required fields

| Field | Meaning |
|-------|---------|
| `source_hub` | Sending hub (`ask` / `move` / `lender` / `insurance` / `contractor` / `senior` / `investor`) |
| `destination_hub` | Receiving hub (same enum) |
| `surface` | Stable low-cardinality surface id |
| `journey_id` | Bounded journey (`purchase`, `relocate`, `coverage`, `contractor`, `senior_care`, `investing`) |
| `context_type` | Controlled vocabulary below |

Compatibility aliases used by existing Lender/Insurance helpers: `from_hub` = `source_hub`, `to_hub` = `destination_hub`, `journey` = `journey_id`.

### Optional fields

`intent` (`buy` / `rent` / `refi`)  
`state` (2-letter code only)

### Surface vocabulary

`situation_router`  
`journey_page`  
`lender_state_results`  
`lender_county_results`  
`lender_tool_completion`  
`move_destination`  
`move_plan_completion`  
`insurance_destination`  
`contractor_plan_completion`  
`contractor_home_next_step`  
`contractor_trust_report_next_step`  
`senior_transition`  
`senior_navigator_completion`

### context_type vocabulary

`home_buy` `relocate` `move_rent` `coverage` `home_project` `senior_transition` `investment_research`

### Privacy

Never send: name, email, phone, address, SSN, account/member IDs, diagnosis, holdings, free-form text, full URLs, raw searchParams, facility CCN, or facility name.

### Excluded surfaces

- Investor Firm Trust Reports and firm search
- Contractor Trust Reports without inbound journey context
- Senior facility evidence before/above CMS research, and facility pages with no journey context
- Find Movers / Compare / Verify DOT / Calculator chrome on Move
- Generic articles that are not a completed research decision
