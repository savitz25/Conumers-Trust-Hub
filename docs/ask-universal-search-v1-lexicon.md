# AskTrustHub Universal Search v1 — Intent Lexicon & Deterministic Parsing Standard

**Document ID:** ASK-SEARCH-002  
**Status:** Specification only — **parser not implemented** (ASK-SEARCH-003)  
**Date:** 2026-08-22  
**Owner repo:** `savitz25/Conumers-Trust-Hub` (AskTrustHub)  
**Binding architecture:** `docs/ask-universal-search-v1-architecture.md` (incl. ASK-SEARCH-001.1)  
**Fixture corpus:** `docs/fixtures/ask-universal-search-intent-corpus.v1.json`

---

## 1. Executive Summary

This document defines the **shared search vocabulary**, synonym system, geography interpretation rules, ambiguity/clarification rules, confidence model, and AI escalation contract for AskTrustHub Universal Search.

**Guiding principle:**

> Deterministic when obvious. AI when helpful. Trust Hub data always determines the providers shown.

### Locked product constraints (do not redesign)

- Ask shows **Top Matches**, normally **5–7**, **maximum 7**
- Option A: entity → specialist Trust Report (context retained)
- Option B: **View More Results** → specialist SERP already loaded
- Structured non-PII handoff (Stage A′ + search extensions)
- No paid/premium ranking; no Google Places; AI never invents providers

### What ASK-SEARCH-002 delivers

1. Canonical Hub / entity / category / consumer-intent vocabulary  
2. Vertical lexicons for all six specialists (evidenced support + soft/unsupported)  
3. Phrase grammar + geo + near-me + confidence + clarification + AI rules  
4. Mapping from dual Ask situation taxonomies → Universal Search concepts  
5. Machine-readable acceptance corpus (≥100 fixtures) for ASK-SEARCH-003  

### What this does **not** deliver

- Production TypeScript parser (ASK-SEARCH-003)  
- Search UI, index, DB, specialist repo edits, deploy  

---

## 2. Existing Taxonomies Found

### 2.1 Ask-owned taxonomies (reuse / unify — do not fork)

| Source | IDs / concepts | Role |
|--------|----------------|------|
| `lib/network/registry.ts` | `ask\|move\|lender\|insurance\|contractor\|senior\|investor` | Canonical Hub IDs |
| `lib/orchestration/journey-links.ts` | `JourneyKind`, `JourneyIntent`, `JourneyContext`, Stage A′ params | Handoff + journey |
| `lib/orchestration/path-generator.ts` | `SituationId`: `move_buy`, `move_rent`, `buy_local`, `refinance`, `coverage_after_move`, `pure_move`, `hire_contractor`, `aging_parent`, `investing_research`, `unknown` | Multi-hub planner |
| `lib/situations.ts` | Card IDs: `moving-scam-risk`, `lender-legit`, `premium-or-medicare`, `buying-home`, `relocating-work`, `hire-contractor`, `aging-parent`, `investment-firm` | Homepage situation cards |
| `lib/growth/journeys.ts` | Editorial journey slugs | Content, not entity search |
| `docs/ASK-NETWORK-CONTRACT.md` | Network V2 evidence posture per Hub | Support boundaries |

**ASK-SEARCH-001 debt:** dual situation taxonomies. Universal Search must **map into** both, not invent a third orphan ID space.

### 2.2 Recommended unification map

| Universal Search primary signal | Planner `SituationId` | Situation card ID |
|---------------------------------|----------------------|-------------------|
| `hub=move` + find_provider | `pure_move` | `moving-scam-risk` / `relocating-work` |
| `hub=move` + buy/relocate life-event | `move_buy` / `move_rent` | `buying-home` / `relocating-work` |
| `hub=lender` + purchase/refi | `buy_local` / `refinance` | `lender-legit` / `buying-home` |
| `hub=insurance` + coverage | `coverage_after_move` (if move context) else directory | `premium-or-medicare` |
| `hub=contractor` | `hire_contractor` | `hire-contractor` |
| `hub=senior` | `aging_parent` | `aging-parent` |
| `hub=investor` | `investing_research` | `investment-firm` |
| Ambiguous / multi-hub life event | keep `primaryHub` + suggest planner | `hubTag: multi` cards |

Parser output should include optional:

```ts
situationIdHint?: SituationId; // planner
situationCardIdHint?: string;  // situations.ts
```

ASK-SEARCH-003 may emit these as soft hints for Concierge/planner bridging — not required for entity SERP.

### 2.3 Specialist evidence (read-only probe; no specialist edits)

| Hub | Confirmed for v1 provider discovery | Soft / fail-closed |
|-----|-------------------------------------|--------------------|
| Move | Carrier/mover, broker, carrier+broker, local/intrastate, interstate, auto transport | Container/storage weaker |
| Lender | Mortgage lenders (company), FDIC banks, auto loan companies; filters FHA/VA/conventional/USDA/jumbo/ARM/refinance | Credit repair / MCA not live; LO not first-class entity |
| Insurance | Agencies/providers (`independent_agent`, `brokerage`, …); product filters homeowners/auto/health/Medicare/life/…; carriers research | “Insurance company” ambiguous; Medicare not inferred from LOA alone |
| Contractor | Controlled trades (e.g. FL: roofers, plumbing, air-conditioning, pool-spa, general-contractors, …); work chips electrical/plumbing/HVAC/roofing/GC | Solar often assist-only; OR endorsement families ≠ trade names |
| Senior | **National:** CMS nursing home / SNF | Assisted living = pilot (not national peer); **memory care national directory not built** — never auto-map AL↔nursing |
| Investor | **Live:** RIA + ERA **firms** (SEC ADV) | Funds/companies reserved; individuals incomplete; ERA ≠ RIA |

---

## 3. Canonical Hub Vocabulary

```ts
export type SearchHubId =
  | 'move'
  | 'lender'
  | 'insurance'
  | 'contractor'
  | 'senior'
  | 'investor';
```

| ID | Consumer label | Evidence orientation |
|----|----------------|----------------------|
| `move` | Move Trust Hub | FMCSA / SAFER |
| `lender` | Lender Trust Hub | NMLS / CFPB / FDIC |
| `insurance` | Insurance Trust Hub | DOI / NAIC / CMS tools |
| `contractor` | Contractor Trust Hub | State licensing boards |
| `senior` | SeniorTrustHub | CMS / supported state regulators |
| `investor` | InvestorTrustHub | SEC / IARD firm research |

Extensibility: future Hubs register via Network contract — lexicon adds a vertical section without renaming these six.

---

## 4. Canonical Entity-Type Vocabulary

Stable IDs used in `TrustHubSearchIntent.entityType` and handoff `entity=`.

### 4.1 Move

| ID | Label | Notes |
|----|-------|-------|
| `mover` | Mover / moving company | Default when “movers” unspecified |
| `interstate_mover` | Interstate mover | When interstate/long-distance explicit |
| `intrastate_mover` | Local / intrastate mover | When local/intrastate explicit |
| `moving_broker` | Moving broker | **≠ mover** when explicit |
| `auto_transporter` | Auto transport / car shipper | Move auto-transport surface |

### 4.2 Lender

| ID | Label | Notes |
|----|-------|-------|
| `mortgage_company` | Mortgage lender / company | Primary directory entity |
| `mortgage_broker` | Mortgage broker | When broker explicit + Hub type supports |
| `bank` | FDIC-insured bank | FDIC vertical |
| `auto_loan_company` | Auto loan company | Live vertical |
| `loan_officer` | Loan officer | **Soft** — not first-class directory entity; clarify or soft-handoff company search |

### 4.3 Insurance

| ID | Label | Notes |
|----|-------|-------|
| `insurance_agency` | Insurance agency | Default business listing |
| `insurance_agent` | Insurance agent | When person/agent language |
| `insurance_brokerage` | Insurance brokerage | When brokerage explicit |
| `insurance_carrier` | Insurance carrier | Carrier research routes |
| `medicare_agent` | Medicare agent/agency | When Medicare + agent/agency |

### 4.4 Contractor

| ID | Label | Notes |
|----|-------|-------|
| `contractor` | Contractor | Default; pair with `category` trade |

### 4.5 Senior

| ID | Label | Support |
|----|-------|---------|
| `nursing_facility` | Nursing home / SNF | **National v1** |
| `assisted_living` | Assisted living / residential care | **Pilot / soft** — do not silently substitute nursing |
| `memory_care` | Memory care | **Unsupported national directory** — fail-closed (see §17) |

### 4.6 Investor

| ID | Label | Support |
|----|-------|---------|
| `ria` / `registered_investment_adviser` | Registered investment adviser firm | **Live** (prefer one canonical ID: `ria`) |
| `era` / `exempt_reporting_adviser` | Exempt reporting adviser | **Live**; never present as RIA |
| `advisory_firm` | Advisory firm | Generic → prefer `ria` when confident, else candidates |
| `investment_adviser` | Investment adviser (firm sense) | Maps to firm research, not personal advice |

**Canonical recommendation for ASK-SEARCH-003:** use `ria` and `era` as primary entity types; treat `registered_investment_adviser` / `exempt_reporting_adviser` as aliases.

---

## 5. Vertical Category Lexicons

Each concept: **canonical ID**, label, hub, entity type, synonyms, abbreviations, related categories, exclusions.

### 5.1 Move

#### `concept.move.mover`

- **entityType:** `mover`  
- **synonyms:** movers, moving company, moving companies, moving service, household goods mover, HHG mover, relocation company  
- **abbreviations:** HHG (with mover/moving context)  
- **exclusions:** moving broker (→ `moving_broker`); moving insurance (→ insurance exclusion path §15); senior moving company (Move, not Senior)

#### `concept.move.interstate_mover`

- **synonyms:** interstate mover, long distance mover, long-distance moving company, cross-country movers  
- **related:** `mover`

#### `concept.move.intrastate_mover`

- **synonyms:** local movers, local moving company, in-state movers, intrastate mover  

#### `concept.move.moving_broker`

- **entityType:** `moving_broker`  
- **synonyms:** moving broker, household goods broker, HHG broker  
- **exclusion:** never silently collapse to `mover`

#### `concept.move.auto_transporter`

- **synonyms:** auto transport, car shipping, car shipper, auto transporter, vehicle shipping company  

### 5.2 Lender

#### `concept.lender.mortgage_company`

- **entityType:** `mortgage_company`  
- **synonyms:** mortgage company, mortgage companies, mortgage lender, home loan company, lenders (with mortgage/home/loan context), home loan lender  

#### Categories (filters — not entity types)

| ID | Synonyms |
|----|----------|
| `fha` | FHA, FHA lender, FHA mortgage |
| `va` | VA, VA loan, VA mortgage |
| `conventional` | conventional loan, conventional mortgage |
| `usda` | USDA loan, USDA mortgage |
| `jumbo` | jumbo mortgage |
| `arm` | ARM, adjustable rate |
| `refinance` | refi, refinance, refinancing |

#### Soft

- `loan_officer` — supported as **query language**, not guaranteed searchable entity  
- `credit_repair`, `mca` — **not live** → unsupported vertical (§17)

### 5.3 Insurance

#### Entities

| Concept | entityType | Synonyms |
|---------|------------|----------|
| agency | `insurance_agency` | insurance agency, agencies |
| agent | `insurance_agent` | insurance agent, agents, local agent |
| brokerage | `insurance_brokerage` | insurance brokerage, insurance broker (agency sense) |
| carrier | `insurance_carrier` | insurance carrier, carriers (with insurance) |
| medicare agent | `medicare_agent` | Medicare agent, Medicare agency |

#### Product categories (filters)

| ID | Synonyms |
|----|----------|
| `homeowners` | home insurance, homeowners insurance, homeowner insurance |
| `auto` | auto insurance, car insurance |
| `health` | health insurance, ACA (with insurance/agency) |
| `medicare` | Medicare, Medigap (careful), Medicare Advantage (product) |
| `life` | life insurance |
| `renters` | renters insurance |
| `flood` | flood insurance |
| `umbrella` | umbrella insurance |

#### Ambiguity: “insurance company”

May mean agency, carrier, or generic provider → see §11.

### 5.4 Contractor

**entityType** always `contractor` + **category** trade slug.

#### Controlled network categories (v1 lexicon — extensible)

Prefer Hub discovery slugs where shared; Ask stores a **network trade id** that adapters map per state.

| Network category ID | Synonyms / aliases | Notes |
|---------------------|--------------------|-------|
| `roofing` | roofer, roofers, roofing contractor, roof company, roof replacement | Maps FL `roofers`, AZ/WA `roofing` |
| `plumbing` | plumber, plumbers, plumbing contractor | |
| `hvac` | HVAC, AC, air conditioning, heating and cooling, mechanical (HVAC sense) | FL `air-conditioning` / `mechanical` adapter choice |
| `electrical` | electrician, electricians, electrical contractor | Work-chip; not always FL CILB discovery page |
| `general_contractor` | general contractor, GC, general contractors, residential contractor, building contractor | FL general/building/residential family |
| `kitchen_remodel` | kitchen remodeler, kitchen renovation, redo my kitchen, remodel kitchen | Studio/plan language → trade/GC soft map |
| `bathroom_remodel` | bathroom remodeler, bath remodel | |
| `pool` | pool contractor, pool builder, spa contractor | FL `pool-spa` |
| `painting` | painter, painting contractor | Evidenced in AZ/WA catalogs |
| `flooring` | flooring installer, floor contractor | Extensible; may soft-handoff GC if Hub lacks slug |
| `solar` | solar installer, solar contractor | **Soft / assist** in several states |

**Extensibility:** adapters declare `supportedCategories[]`; unknown category → unsupported handling (§17) or soft handoff to Hub with `entity=contractor` only.

### 5.5 Senior

| Concept | entityType | Support | Synonyms |
|---------|------------|---------|----------|
| Nursing / SNF | `nursing_facility` | **National** | nursing home, nursing homes, nursing facility, SNF, skilled nursing, skilled nursing facility, long term care facility *(when nursing/SNF sense)* |
| Assisted living | `assisted_living` | **Pilot soft** | assisted living, care home, residential care, adult care home, personal care home |
| Memory care | `memory_care` | **Unsupported national** | memory care, memory care facility, Alzheimer’s care *(do not map to nursing)* |
| Generic senior care | ambiguity | — | senior care, senior facility, senior living, place for elderly mother |

**Hard rule:** assisted living ≠ nursing home; memory care ≠ nursing home unless user clarifies and Hub supports.

### 5.6 Investor

| Concept | entityType | Synonyms | Exclusions |
|---------|------------|----------|------------|
| RIA firm | `ria` | RIA, registered investment adviser, registered investment advisor, investment adviser firm | ERA |
| ERA firm | `era` | ERA, exempt reporting adviser, exempt reporting advisor | Must not label as RIA |
| Advisory firm | `advisory_firm` | advisory firm, investment advisory firm | May clarify RIA vs ERA |
| Soft generics | candidates | financial advisor, financial adviser, wealth advisor, wealth manager, investment firm, investment company | Often low confidence — §11 |

**Live data:** firm-level SEC ADV. Do not promise individual IAR/BrokerCheck search as v1 supported.

---

## 6. Synonym / Alias Rules

1. **Case-insensitive**; strip punctuation except meaningful hyphens in compounds.  
2. **Plural/singular** collapse (`movers`→mover concept).  
3. **US/UK spelling:** adviser/advisor both accepted; canonicalize labels per Hub copy (Investor prefers “adviser” in regulatory copy).  
4. **Longest-match wins** for multi-word phrases (`moving broker` before `broker`; `mortgage company` before `company`).  
5. **Category modifiers attach after entity** (`FHA lenders` → entity mortgage_company + category fha).  
6. Synonym tables are **curated**, versioned with this document (`lexicon_version: 1`).  

---

## 7. Search Phrase Grammar

### 7.1 Pattern hierarchy (precedence high → low)

1. Multi-word **exclusion compounds** (§15) — e.g. `moving insurance`, `senior moving company`, `investment property mortgage`  
2. Multi-word **entity/category phrases** — e.g. `moving broker`, `registered investment adviser`, `skilled nursing facility`  
3. **Geography spans** — `in|near|around|serving` + location; trailing `CITY ST`; ZIP; county  
4. Single-token entities / trades  
5. Need/request language (`someone to`, `I need`, `looking for`) → consumer intent `find_provider` + parse remainder  
6. Life-event multi-hub cues → primary + related hubs (§16)  
7. Residual keywords → low confidence / clarification  

### 7.2 Canonical patterns

```text
[entity] in [location]
[entity] near [location]
[entity] around [ZIP|location]
[entity] serving [location]
[category] [entity] in [location]
[location] [entity]
[need-language] + [service/category] + [location]
[entity] near me
```

### 7.3 Precedence after match

1. Lock entity/category concepts  
2. Lock geography (precision)  
3. Infer Hub from entity/category  
4. Evaluate ambiguities → candidates  
5. Assign confidence  
6. Decide: deterministic emit | clarify | AI escalate  

---

## 8. Geography Interpretation Standard

**No Google Places.**

### 8.1 Targets

| Precision | Examples |
|-----------|----------|
| `state` | Florida, FL, NJ, New Jersey |
| `county` | Bergen County NJ, Miami-Dade |
| `city` | Keansburg NJ, Austin Texas, Miami FL |
| `zip` | 07734, 33101, 78701 |
| `radius` | around ZIP / near (with optional miles later) |
| `near_me` | unresolved until permission/ZIP (§9) |

Internal state representation: **USPS 2-letter** (`NJ`, `TX`).  
Also emit `stateSlug` for Hub URLs (`new-jersey`) via existing `normalizeState` in `journey-links.ts`.

### 8.2 Recommended data strategy (implementation later)

| Need | Strategy |
|------|----------|
| State names/abbreviations | Reuse `US_STATES` in `journey-links.ts` |
| ZIP → city/state(/county) | Offline USPS/Census ZCTA-compatible table checked into Ask or shared package — **not** Places |
| City → state | Gazetteer; if ambiguous city (`Springfield`) → clarification |
| County | Slug normalize via `normalizeCountySlug`; Hub county lists when available |
| Known Move cities | Reuse `MOVE_CITY_HUBS` as high-confidence boost |

### 8.3 Duplicate city rule

If city name exists in multiple states and no state/ZIP provided → `confidence: medium|low`, `ambiguity: location`, `requiresClarification: true`.

### 8.4 ZIP rule

5-digit ZIP → resolve state (and city when table allows) → `precision: zip` (may also fill city/state).

---

## 9. Intent / Entity / Category Separation

| Layer | Meaning | Example |
|-------|---------|---------|
| **Hub** | Which specialist | `move` |
| **Entity type** | What kind of provider record | `mover` |
| **Category** | Subtype / product / trade filter | `interstate`, `fha`, `roofing` |
| **Consumer intent** | What the user is trying to do | `find_provider` |

### 9.1 Consumer intents (v1)

| ID | Meaning |
|----|---------|
| `find_provider` | Directory / Top Matches search (default for Universal Search) |
| `verify` | Verify a known ID (USDOT, NMLS, license) — may soft-route Hub tools |
| `compare` | Compare entities (later) |
| `research` | Generic research / editorial |
| `calculate` | Calculator tools |
| `analyze_document` | Document tools |
| `life_event` | Multi-hub journey (planner), not entity SERP |

### 9.2 Example

`licensed movers in Keansburg NJ`

```text
consumerIntent = find_provider
hub = move
entityType = mover
location = Keansburg, NJ
filters.regulatoryEligibleOnly = true   // from "licensed" — NOT an entity type
confidence = high
```

---

## 10. Hub Routing Precedence

### 10.1 High-confidence keyword → Hub

| Signal | Hub |
|--------|-----|
| mover, moving company, USDOT, FMCSA, auto transport | move |
| mortgage, lender, NMLS, FHA/VA loan (mortgage sense), refinance | lender |
| insurance agent/agency, Medicare agent, homeowners insurance | insurance |
| roofer, plumber, electrician, HVAC, remodeler, contractor | contractor |
| nursing home, SNF, senior care facility | senior |
| RIA, ERA, registered investment adviser, advisory firm (firm sense) | investor |

### 10.2 Ambiguous single tokens (must not guess alone)

| Term | Candidates | Action |
|------|------------|--------|
| `broker` | move / lender / insurance | Clarify |
| `company` / `companies` | too generic | Clarify or need context |
| `agent` | insurance (default if insurance words) else clarify | |
| `advisor` / `adviser` | investor soft; may clarify | |
| `facility` | senior soft | |
| `carrier` | move (FMCSA) vs insurance carrier | Need context |

---

## 11. Ambiguity & Clarification Rules

### 11.1 When to clarify (not show providers)

- Hub cannot be uniquely determined (`broker in Tampa`)  
- City cannot be uniquely determined (`Springfield` alone)  
- Entity/category conflict (assisted living vs nursing when both plausible and user said only “senior care”)  
- Soft generics with no Hub cue (`company near me`)

### 11.2 Clarification UX examples

**`broker in Tampa`**

> What type of broker are you looking for?  
> • Moving broker · Mortgage broker · Insurance broker

**`senior care in Springfield`** (multi-state city)

> Which Springfield?  
> • Springfield, IL · Springfield, MO · … (top candidates)

**`insurance company near me`**

> Are you looking for a local agency/agent, or a carrier (insurance company)?

### 11.3 When **not** to over-clarify

- `movers in Keansburg NJ` — proceed  
- `roofers Miami` — if Miami unambiguously FL in gazetteer/context, proceed (or attach FL with high confidence)  
- `RIA Boca Raton` — proceed Investor / ria  

Keep Ask fast: clarify only when wrong Hub/entity would be likely.

---

## 12. Confidence Model

### 12.1 Consumer/application levels

| Level | Criteria (measurable) |
|-------|------------------------|
| **high** | Unique Hub + unique entityType (or unique category→entity) + geography resolved to state or finer without location ambiguity; no open exclusion conflict |
| **medium** | Hub+entity clear but geo incomplete/ambiguous **or** category soft-mapped **or** entity soft (loan officer, assisted living pilot) |
| **low** | Multiple Hub candidates **or** unresolved near-me **or** only generic tokens |

### 12.2 Optional internal score (ASK-SEARCH-003)

Expose `confidenceScore: 0–1` internally while product logic uses `high|medium|low` thresholds, e.g.:

- high ≥ 0.80  
- medium ≥ 0.50  
- else low  

### 12.3 Actions by confidence

| Confidence | Default action |
|------------|----------------|
| high | Emit intent; run discovery Top Matches |
| medium | Emit intent; may show soft banner (“Showing results for …”) |
| low | Clarification UI; do not invent providers |

---

## 13. AI Escalation Rules

### 13.1 Must remain deterministic (no LLM required)

```text
movers in Keansburg NJ
mortgage companies in FL
roofers in Miami
nursing homes in Austin TX
RIA in Boca Raton
Medicare agents in Indiana
licensed movers around 07734
FHA lenders Tampa
```

### 13.2 May escalate to LLM **after** deterministic pass

```text
someone to redo my kitchen before I sell my house
my mother cannot safely live alone anymore and I need a place near Austin
I am moving from NJ to Florida and buying a house
I need someone who can help with my roof after storm damage
who can help me refinance because my payment is too high
```

### 13.3 AI contract

```text
AI → structured TrustHubSearchIntent only (validated against allowlists)
structured intent → Trust Hub datasets / discovery
NEVER: AI → invented provider list
```

Reject LLM outputs that invent hubs, entity types, or provider names as results.

---

## 14. Misspelling / Normalization Rules

### 14.1 Bounded curated corrections (examples)

| Input | Normalized |
|-------|------------|
| mortage | mortgage |
| insurence | insurance |
| contracter / contracters | contractor |
| assited living | assisted living |
| advisoer | adviser |
| refi | refinance (category/intent cue) |
| snf | skilled nursing / nursing_facility |

### 14.2 Strategy

1. Curated high-value map (this lexicon)  
2. Unicode/punctuation normalize  
3. Future index fuzzy match on discovery names (implementation)  
4. AI only if still unreadable and query length warrants  

Do **not** ship a general-purpose spell engine in v1 parser.

---

## 15. Negative / Exclusion Vocabulary

Critical misroute preventers:

| Query cue | Wrong route | Correct handling |
|-----------|-------------|------------------|
| `moving insurance` | Insurance agency SERP alone | Prefer Move educational/insurance-for-move OR Insurance with category ambiguous — **do not** treat as generic agency search without cue; often Move resource + optional Insurance clarify |
| `investment property mortgage` | Investor | **Lender** (mortgage) primary |
| `senior moving company` | Senior | **Move** (`mover`) |
| `mortgage insurance` | generic insurance | Lender/loan context — clarify or Lender educational |
| `home inspector` | contractor trades blindly | Unsupported / soft unless Hub trade exists — fail-closed or soft Hub handoff |
| `wealth management` alone | force RIA | Low confidence Investor clarify |
| `ERA` alone | label as RIA | `era` entity, Investor |

Exclusion compounds are matched **before** generic entity tokens.

---

## 16. Multi-Hub Compatibility

v1 Universal Search SERP = **single primary Hub**.

Life-event phrases may additionally emit:

```ts
primaryHub: SearchHubId
relatedHubs?: SearchHubId[]
journeyKind?: JourneyKind
situationIdHint?: SituationId
consumerIntent: 'life_event' | 'find_provider'
```

Examples:

| Query | primaryHub | relatedHubs | situationIdHint |
|-------|------------|-------------|-----------------|
| moving to Florida and need a mortgage | move | [lender] | move_buy |
| buying a house and need insurance | lender | [insurance] | buy_local |
| moving my mother into senior care | senior | [move?] | aging_parent |
| renovating a home I just bought | contractor | [lender?] | hire_contractor |

**Do not** render multi-Hub entity mashup lists in v1. Bridge to existing B.2 What’s Happening planner.

---

## 17. Unsupported Query Handling

Fail-closed. Never fabricate; never silent wrong-category substitute.

| Case | Behavior |
|------|----------|
| Memory care (national) | Message: no dedicated Memory Care dataset yet; offer SeniorTrustHub nursing research options + View More / Hub handoff without pretending memory-care matches |
| Assisted living outside pilot posture | Soft handoff / clarify; do not dump nursing results labeled as assisted living |
| Credit repair / MCA | Unsupported Lender vertical — honest empty + Hub homepage soft handoff |
| Investor funds / public companies | Unsupported — soft handoff Investor research home |
| Loan officer as entity | Soft: search mortgage companies **or** clarify |
| Unknown contractor trade | Soft handoff contractor Hub with geo + `entity=contractor` only |

---

## 18. Parser Acceptance Matrix

Full machine-readable set: `docs/fixtures/ask-universal-search-intent-corpus.v1.json`.

### 18.1 Critical examples (normative summary)

| Query | Hub / candidates | Entity / category | Geo | Conf. | Clarify? | AI? | Supported? |
|-------|------------------|-------------------|-----|-------|----------|-----|------------|
| movers in Keansburg NJ | move | mover | Keansburg, NJ | high | no | no | yes |
| licensed movers around 07734 | move | mover + licensed filter | ZIP 07734 | high | no | no | yes |
| long distance mover Florida | move | interstate_mover | FL | high | no | no | yes |
| moving broker in Miami | move | moving_broker | Miami, FL | high | no | no | yes |
| mortgage companies in Florida | lender | mortgage_company | FL | high | no | no | yes |
| FHA lenders Tampa | lender | mortgage_company + fha | Tampa, FL | high/med | no* | no | yes |
| refinance company near Austin | lender | mortgage_company + refinance | Austin, TX | high/med | no* | no | yes |
| Medicare agents Indiana | insurance | medicare_agent | IN | high | no | no | yes |
| home insurance companies in Miami | insurance | agency/carrier ambiguity + homeowners | Miami, FL | medium | maybe | no | yes soft |
| insurance company near me | insurance candidates | ambiguous | near_me | low | yes | no | soft |
| roofers Miami | contractor | contractor + roofing | Miami, FL | high | no | no | yes |
| kitchen remodeler Fort Lauderdale | contractor | contractor + kitchen_remodel | Fort Lauderdale, FL | high/med | no | no | yes soft map |
| someone to redo my kitchen | contractor | kitchen_remodel | missing | medium | geo | **yes optional** | soft |
| nursing homes Austin Texas | senior | nursing_facility | Austin, TX | high | no | no | yes |
| senior care near 78701 | senior | senior_care ambiguous | ZIP | medium | maybe type | no | partial |
| assisted living Austin | senior | assisted_living | Austin, TX | medium | no | no | pilot soft |
| RIA Boca Raton | investor | ria | Boca Raton, FL | high | no | no | yes |
| investment advisers in Palm Beach County | investor | ria/advisory_firm | Palm Beach County, FL | high | no | no | yes |
| financial advisor near me | investor soft | advisory_firm | near_me | low | yes | no | soft |
| broker in Tampa | move/lender/insurance | — | Tampa | low | **yes** | no | — |
| company near me | — | — | near_me | low | **yes** | no | — |
| moving insurance | exclusion | — | — | medium | maybe | no | special |
| senior moving company | move | mover | — | high | no | no | yes |
| investment property mortgage | lender | mortgage_company | — | high | no | no | yes |
| I'm moving from New Jersey to Florida and buying a house | move primary | life_event | origin NJ dest FL | medium | no | **optional** | planner bridge |

\*Tampa/Austin without state: gazetteer should attach FL/TX with high confidence for well-known cities; if not, medium + clarify.

---

## 19. Risks / Open Questions

1. **Shared ZIP/city gazetteer packaging** — where to host offline tables on Ask without Places.  
2. **Contractor network trade IDs vs per-state slugs** — adapter mapping table ownership.  
3. **Insurance “company” default** — product decision: prefer agency vs ask every time.  
4. **Senior assisted living pilot exposure** — when to show AL Top Matches vs soft handoff only.  
5. **Loan officer search** — confirm with Lender product before entityType goes live.  
6. **Moving insurance** UX copy — Move resource vs Insurance clarify.  
7. Unifying situation card IDs vs planner IDs in one code module (ASK-SEARCH-003 prep).  

---

## 20. ASK-SEARCH-003 Implementation Contract

ASK-SEARCH-003 **should**:

1. Implement `parseUniversalSearchQuery(raw: string): TrustHubSearchIntent` in Ask TypeScript.  
2. Load curated synonym/exclusion tables derived from this document.  
3. Reuse `normalizeState` / `US_STATES` / `MOVE_CITY_HUBS`.  
4. Pass fixtures in `ask-universal-search-intent-corpus.v1.json` (deterministic cases).  
5. Validate LLM assist outputs against allowlisted hubs/entityTypes/categories.  
6. Emit handoff-ready structured fields (`state`, `county`, `city`, `zip`, `entity`, `category`).  
7. Never return provider entities from the parser — only intent.

ASK-SEARCH-003 **must not**:

- Call Google Places  
- Invent providers  
- Edit specialist repositories  
- Build search UI/index (later tasks)  
- Expand Ask preview beyond max 7 Top Matches policy  

### Readiness

| Item | Status |
|------|--------|
| Architecture (001 / 001.1) | Locked |
| Lexicon (002) | This document |
| Fixtures | `docs/fixtures/ask-universal-search-intent-corpus.v1.json` |
| Blockers for 003 | Gazetteer data choice (can stub states+known cities first); Hub adapter mapping can start Move/Lender-only |

**ASK-SEARCH-003 may begin after review/acceptance of this lexicon** — not as part of ASK-SEARCH-002.

---

## Appendix — Near Me privacy (Phase 5)

```text
movers near me / roofers near me / senior care near me
```

1. If user grants coarse location permission → resolve to city/ZIP/state class geography.  
2. Else → prompt for ZIP or city/state.  
3. Do not silently assume precise GPS.  
4. Do not put precise coordinates in cross-domain URLs; prefer ZIP/city/state structured params.

---

*End of ASK-SEARCH-002.*
