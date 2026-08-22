# AskTrustHub Universal Search v1 — Architecture

**Document ID:** ASK-SEARCH-001  
**Status:** Architecture & specification only — **not implemented**  
**Date:** 2026-08-22  
**Owner repo:** `savitz25/Conumers-Trust-Hub` (AskTrustHub parent)  
**Canonical parent:** https://www.asktrusthub.com  
**Contract baseline:** Network V2 `2026.08.18-network-v2` (`docs/ASK-NETWORK-CONTRACT.md`)

---

## 1. Executive Summary

**Universal Search** makes AskTrustHub the intelligent **discovery layer** for the Trust Hub Network.

A consumer types natural language such as:

- `movers in Keansburg NJ`
- `mortgage companies in Florida`
- `senior care facilities in Austin Texas`
- `roofing contractors in Miami`
- `licensed movers around 07734`

Ask should:

1. Understand **intent + geography** (and hub when clear).
2. Route to the correct **specialist Trust Hub**.
3. Retrieve **authoritative Hub data** (never AI-invented providers).
4. Show a **small preview** (≈5–10 cards) on Ask.
5. Hand the consumer into the specialist Hub **with the search context intact** — no repeated search.

### Network model (locked)

| Layer | Role | Domains |
|-------|------|---------|
| AskTrustHub | Discovery, account/journey orchestration, standards | `www.asktrusthub.com` |
| Six specialists | Deep research authority | Move, Lender, Insurance, Contractor, Senior, Investor — each on its **own** public domain |

**Do not** move specialist SEO under `asktrusthub.com/move` (or equivalents).  
Specialist domains remain independent public websites.

### Core principle

```text
Natural-language query
        ↓
Query understanding
        ↓
Structured intent
        ↓
Trust Hub routing
        ↓
Authoritative Hub data
        ↓
AskTrustHub preview results
        ↓
Specialist Hub deep research
```

- **AI may help understand a query.**
- **AI must not invent provider/facility/adviser results.**
- Results come from Trust Hub datasets (or their published discovery projections).

### Relationship to existing Ask systems

Universal Search **extends** Stage B.2/B.3 orchestration and Stage A′ journey URLs.  
It does **not** replace the What’s Happening planner, Concierge, or Network registry with a second competing router.

| Existing system | Role after Universal Search |
|-----------------|----------------------------|
| Situation planner / path generator | Remains for **multi-hub life events** |
| Concierge (`/api/chat`) | Remains for free-form Q&A; may emit structured intent |
| Stage A′ journey params | **Reuse and extend** for search handoff |
| Network registry | Hub IDs / origins / switcher |
| My Trust Journey | Optional continuity after research (no login wall) |

---

## 2. Current-State Findings

**Worktree for this doc:** `ask-search-001` · branch `ask-search-001-universal-search-arch` · base SHA `31b20cd` (origin/main).

### 2.1 Stack

| Item | Value |
|------|--------|
| Package | `ask-trust-hub` 2.1.0 |
| Framework | Next.js **15.5.19** App Router |
| React | 19.1.0 |
| Analytics | `@vercel/analytics` |
| AI | xAI Concierge (`lib/ai/xai.ts`, `POST /api/chat`) |
| Ask DB / search engine | **None** (no Postgres, Algolia, Meilisearch, Elasticsearch, vector index) |

### 2.2 What Ask already does well

| Capability | Location | Notes |
|------------|----------|-------|
| Network registry | `lib/network/registry.ts` | Typed hub IDs + canonical origins |
| Situation → multi-hub plan | `lib/orchestration/path-generator.ts` | Ordered research paths |
| Deep-link builders | `lib/orchestration/journey-links.ts` | Move/Lender/Insurance (rich); Contractor/Senior/Investor (soft root) |
| Stage A′ URL contract | `?src=&journey=&state=&county=&intent=` | Non-PII cross-domain context |
| Keyword situation match | `lib/situations.ts` | Deterministic, client-side |
| Journey handoff analytics | `lib/analytics/journey-handoff.ts` | Allowlisted fields |
| My Trust Journey metadata | `lib/orchestration/journey-metadata.ts` | Ask-origin `localStorage` only |
| SEO invariants | Network contract §8 | No geo farms; no param landing pages as SEO |

### 2.3 What Ask does **not** have today

- Entity / provider search UI or API
- Federated Hub search clients
- Central discovery index of specialist entities
- Geography resolver beyond state/county helpers + known Move city hubs
- Ranking of entities on Ask
- Search-specific analytics events (`network_search_*`)

### 2.4 Dual situation taxonomies (debt)

Two related but distinct ID systems exist:

1. **Situation cards** — `lib/situations.ts` (`moving-scam-risk`, `buying-home`, …)
2. **Planner situations** — `SituationId` in `path-generator.ts` (`move_buy`, `pure_move`, …)

Universal Search should introduce a **single intent vocabulary** that maps to both, rather than inventing a third orphaned taxonomy.

### 2.5 Product posture (must preserve)

From `docs/ASK-NETWORK-CONTRACT.md`:

> Ask is a **thin parent**: it routes consumers to specialists. Specialist hubs perform the deep research. Ask does **not** host provider directories and is **not** a lead marketplace.

Universal Search **previews** entities; it does **not** become a sixth directory clone on Ask.

### 2.6 Forbidden patterns (already contracted)

- Google Places API for Network V2 discovery
- Paid placements / lead ranking
- Cross-hub PII in URLs
- Mass Ask SEO pages competing with specialist local SEO

---

## 3. Recommended Architecture

### 3.1 Recommendation: **Hybrid (Option C)**

| Option | Verdict |
|--------|---------|
| **A — Federated runtime only** | Rejected as sole design: high latency, brittle multi-origin fan-out, uneven Hub API maturity, poor offline/failover for Ask preview |
| **B — Central full index only** | Rejected as sole design: risks duplicating specialist SOTs, freshness/schema drift, thin-parent violation if Ask becomes the research store |
| **C — Hybrid** | **Recommended** |

**Hybrid shape:**

```text
┌─────────────────────────────────────────────────────────────────┐
│                     AskTrustHub (parent)                        │
│  ┌──────────────┐   ┌─────────────────┐   ┌─────────────────┐  │
│  │ Query        │→  │ Structured      │→  │ Preview         │  │
│  │ Understanding│   │ Search Intent   │   │ Ranker + Cards  │  │
│  └──────────────┘   └────────┬────────┘   └────────▲────────┘  │
│                              │                      │           │
│                              ▼                      │           │
│                     ┌─────────────────┐             │           │
│                     │ Network         │─────────────┘           │
│                     │ Discovery Index │  (lightweight records)  │
│                     └────────┬────────┘                         │
│                              │ publish / sync                   │
└──────────────────────────────┼──────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
   Move Hub API          Lender Hub API         …other Hubs
   (authoritative)       (authoritative)        (authoritative)
        │                      │                      │
        └────────── deep research / Trust Report ─────┘
```

**Ask holds enough to FIND.**  
**Specialists hold enough to RESEARCH.**

### 3.2 Option comparison (summary)

| Criterion | Federated (A) | Central only (B) | Hybrid (C) |
|-----------|---------------|------------------|------------|
| Latency for Ask preview | Poor (N round-trips) | Best | Good |
| Freshness | Best | Weak unless frequent sync | Good (index + optional live enrich) |
| Coupling | High runtime | High schema ownership on Ask | Medium — adapter contract |
| Schema drift | Per-Hub | Ask absorbs all | Controlled via discovery schema version |
| Privacy | Data stays on Hub | Ask stores more | Ask stores **minimal** discovery fields |
| SEO | Neutral | Risk of Ask competing | Controlled (noindex Ask SERPs) |
| Failover | One Hub down → hole | Ask alone works stale | Preview from index; handoff may degrade |
| New Hub onboarding | New live API required day-1 | Full reindex | Adapter + discovery publisher |
| Thin-parent fidelity | Strong | Weak if over-indexed | **Strong if fields stay lean** |

### 3.3 Runtime flow (v1)

1. User submits query on Ask (anonymous OK).
2. **Query Understanding** → `TrustHubSearchIntent` (+ confidence, parse method).
3. If hub/entity ambiguous → clarification UI (not invent results).
4. Query **Network Discovery Index** filtered by hub + geo + entity/category.
5. Apply **relevance ranking** (never payment/premium).
6. Render **5–10 preview cards** + “See all on {Hub}”.
7. Handoff URL carries Stage A′ + search extension params → specialist opens matching experience.
8. Optional: specialist returns to Ask / My Trust Journey for save (later).

### 3.4 What stays out of Ask’s store

- Full Trust Report payloads
- Complaint narratives / document blobs
- Calculator inputs, shortlists, notes
- Health / holdings / PII
- Google Places enrichment layers used only inside specialist products

---

## 4. Search Query Contract

Recommend a **versioned** intent object that composes with (does not replace) `JourneyContext`.

### 4.1 Recommended types

```ts
/** Extensible hub id — v1 uses NetworkHubId specialists; future hubs register here. */
export type SearchHubId =
  | 'move'
  | 'lender'
  | 'insurance'
  | 'contractor'
  | 'senior'
  | 'investor'
  | (string & {}); // future specialists — prefer registry over free string at runtime

export type SearchParseMethod =
  | 'deterministic'
  | 'taxonomy'
  | 'geo_resolver'
  | 'llm_assist'
  | 'fallback_keyword'
  | 'mixed';

export type SearchConfidence = 'high' | 'medium' | 'low';

export type GeoPrecision =
  | 'zip'
  | 'city'
  | 'county'
  | 'state'
  | 'metro'
  | 'radius'
  | 'unknown';

export type TrustHubSearchLocation = {
  raw?: string;
  stateCode?: string;   // USPS 2-letter
  stateSlug?: string;
  stateName?: string;
  countySlug?: string;
  citySlug?: string;
  cityName?: string;
  zip?: string;
  latitude?: number;    // only if already lawfully present in Hub data
  longitude?: number;
  radiusMiles?: number;
  precision: GeoPrecision;
};

/**
 * Universal Search structured intent (Ask-owned).
 * Provider results are NEVER derived from this object alone —
 * it only selects which Hub data to query.
 */
export type TrustHubSearchIntent = {
  version: 1;
  query: string;

  hub?: SearchHubId;
  hubCandidates?: SearchHubId[]; // when ambiguous

  /** Coarse consumer goal — aligns with JourneyKind where possible */
  journeyKind?: 
    | 'relocate'
    | 'purchase'
    | 'refi'
    | 'coverage'
    | 'senior_care'
    | 'investing'
    | 'contractor'
    | 'directory'      // pure find-providers
    | 'unknown';

  entityType?: SearchEntityType;
  category?: string;           // trade, coverage product, facility class, etc.
  categoryLabels?: string[];   // display synonyms

  location?: TrustHubSearchLocation;
  origin?: TrustHubSearchLocation;      // e.g. move from
  destination?: TrustHubSearchLocation; // e.g. move to

  filters?: SearchFilters;

  parseMethod: SearchParseMethod;
  confidence: SearchConfidence;
  ambiguities?: SearchAmbiguity[];
};

export type SearchEntityType =
  // Move
  | 'mover'
  | 'interstate_mover'
  | 'intrastate_mover'
  | 'broker'
  | 'auto_transporter'
  // Lender
  | 'lender'
  | 'mortgage_company'
  | 'loan_officer'
  // Insurance
  | 'insurance_agency'
  | 'insurance_agent'
  | 'insurance_carrier'
  // Contractor
  | 'contractor'
  // Senior
  | 'senior_facility'
  | 'nursing_facility'
  | 'assisted_living'
  // Investor
  | 'investment_adviser'
  | 'advisory_firm'
  | 'ria'
  | 'era'
  // Extensible
  | 'unknown'
  | (string & {});

export type SearchFilters = {
  regulatoryEligibleOnly?: boolean;
  trustReportAvailable?: boolean;
  mortgageType?: string;
  coverageType?: string;
  trade?: string;
  facilityType?: string;
  serviceAreaRequired?: boolean;
  /** Hub-specific opaque bag — never required for Ask ranking core */
  hubExtras?: Record<string, string | number | boolean>;
};

export type SearchAmbiguity =
  | { type: 'hub'; options: SearchHubId[] }
  | { type: 'location'; options: TrustHubSearchLocation[] }
  | { type: 'entity_type'; options: SearchEntityType[] }
  | { type: 'category'; options: string[] };
```

### 4.2 Vertical coverage (v1 minimum)

| Hub | Entity / category examples | Geo |
|-----|----------------------------|-----|
| Move | mover, interstate/intrastate, broker, auto transporter | city/county/state/zip/service area |
| Lender | lender, mortgage company, loan officer (if Hub supports) | geo + mortgage type filter |
| Insurance | agency, agent, carrier (where appropriate) | geo + product/coverage |
| Contractor | contractor + trade/profession | geo + service area |
| Senior | facility types supported by Hub | geo + facility class |
| Investor | adviser / firm / RIA / ERA / regulatory class | geo + classification |

### 4.3 Composition with Stage A′ journey params

When handing off, map intent → existing query keys where possible:

| Search intent field | Journey / handoff param |
|---------------------|-------------------------|
| (always) | `src=ask` |
| `journeyKind` | `journey=` |
| `location.stateCode` | `state=` |
| `location.countySlug` | `county=` |
| buy/rent/refi | `intent=` |
| entity/category | **new** `entity=` / `category=` (see §10) |
| city / zip | **new** `city=` / `zip=` when Hub URLs support them |

Do **not** put free-text `query=` with PII risk into specialist URLs by default; prefer structured fields.

---

## 5. Network Discovery Entity Contract

Ask must **not** duplicate each Hub’s full regulatory database.

### 5.1 Principle

> Ask stores enough information to **FIND** an entity.  
> The specialist Hub stores enough information to **RESEARCH** the entity.

### 5.2 Recommended discovery record (lightweight)

```ts
export type NetworkDiscoveryEntity = {
  /** Stable network-scoped id: `${hub}:${source_entity_id}` or Hub-issued UUID */
  network_entity_id: string;
  hub: SearchHubId;
  source_entity_id: string;

  entity_type: SearchEntityType;
  display_name: string;
  legal_name?: string;

  city?: string;
  county?: string;
  state?: string;          // 2-letter preferred
  zip?: string;
  latitude?: number;       // only if Hub already publishes lawfully
  longitude?: number;

  /** Coarse service coverage tokens (zip prefixes, counties, "nationwide") */
  service_area?: string[];
  categories?: string[];   // trades, products, facility classes

  /** One-line, Hub-authored — not a Trust Score */
  regulatory_status_summary?: string;
  trust_report_available: boolean;

  canonical_profile_url: string;  // absolute specialist URL
  canonical_search_url?: string;  // specialist SERP / directory URL for this geo

  search_terms?: string[];        // normalized tokens for recall
  updated_at: string;             // ISO-8601
  source_version: string;         // Hub dataset / export version
  discovery_schema_version: 1;
};
```

### 5.3 Field ownership

| Field class | Where it lives | Ask may store? |
|-------------|----------------|----------------|
| Identity + geo + categories + URLs | Discovery record | **Yes** |
| Regulatory status one-liner | Discovery (Hub-authored) | **Yes** (stale-tolerant) |
| Trust Score / full evidence matrix | Specialist only | **No** |
| Complaints, docs, calculators | Specialist only | **No** |
| Consumer shortlists / notes | Specialist workspace / future account | **No** on discovery index |
| Lat/lng | Only if Hub already has lawful coords | Optional |

### 5.4 Publication model

Each Hub (or a Hub-owned export job) publishes discovery batches to Ask’s index:

- Format: versioned JSON lines / parquet / Hub API pull (implementation later)
- Cadence: Hub-defined (daily typical; not real-time required for v1 preview)
- Delete/tombstone: required when entities leave the Hub corpus
- Schema version negotiation: Ask rejects incompatible major versions

Ask never scrapes Hub HTML for indexing.

---

## 6. Hub Adapter Contract

Each specialist participates via a **Search Adapter** — a checked-in capability descriptor + optional runtime endpoints.

### 6.1 Adapter descriptor (config, not runtime scrape)

```ts
export type HubSearchAdapter = {
  hub: SearchHubId;
  displayName: string;
  origin: string; // from CANONICAL_ORIGINS

  supportedEntityTypes: SearchEntityType[];
  supportedCategories?: string[]; // taxonomy ids
  geoCapabilities: Array<'state' | 'county' | 'city' | 'zip' | 'radius' | 'service_area'>;

  /** How Ask builds "see all" URLs today / target */
  buildSearchHandoffUrl: (intent: TrustHubSearchIntent) => string;

  /** Optional live enrich — never the sole source of entity list */
  livePreviewEndpoint?: string; // future; Hub-owned HTTPS

  discoveryPublisher: 'export_job' | 'pull_api' | 'none_yet';
  maturity: 'v1_ready' | 'soft_handoff_only' | 'planned';
};
```

### 6.2 Current maturity (architecture assessment)

| Hub | Deep-link maturity today | Discovery publish (future) | v1 Ask preview posture |
|-----|--------------------------|----------------------------|------------------------|
| Move | Strong (`local-movers`, city hubs, verify-dot) | Required for preview | Primary pilot candidate |
| Lender | Strong (`local-lenders/...`) | Required | Strong candidate |
| Insurance | Medium (`destinations/...`) | Required | Candidate with softer cards |
| Contractor | Soft root handoff today | Required | Preview after Hub search URL contract exists |
| Senior | Soft root today | Required | Same |
| Investor | Soft root today | Required | Same — firm research only, no advice |

**v1 sequencing implication:** ship Ask Universal Search UX + contracts network-wide; enable **preview cards** per Hub as that Hub’s discovery export + handoff URL become ready. Soft-handoff Hubs still get parsed intent → Hub homepage/tool with params (no fake entities).

### 6.3 Adapter obligations

1. Never ask Ask to invent entities when discovery is empty — return zero results + handoff.
2. Preserve independence: no paid boost fields in discovery records.
3. Provide `canonical_profile_url` that is crawlable and specialist-canonical.
4. Keep `regulatory_status_summary` factual and short.
5. Version `source_version` on every publish.

### 6.4 Extensibility (7th+ Hub)

1. Add hub to Network registry contract (IDs, origin, switcher label).
2. Register `HubSearchAdapter`.
3. Implement discovery publisher.
4. Map entity types + taxonomy.
5. Implement `buildSearchHandoffUrl`.
6. Enable preview in Ask feature flag — **no Ask core rewrite**.

---

## 7. Query Understanding Pipeline

### 7.1 Layered design (deterministic first)

```text
Raw query
  → 1. Normalize (trim, unicode, expand state abbrev)
  → 2. Deterministic patterns (hub nouns, zip, "in/near/around CITY ST")
  → 3. Taxonomy / synonym map (mover↔moving company, RIA↔adviser firm…)
  → 4. Geography resolver (state table, zip→state, known city tables — Hub-assisted later)
  → 5. LLM assist ONLY if confidence < threshold OR ambiguities remain
  → 6. Fallback keyword hub guess + clarification UI
  → TrustHubSearchIntent
```

### 7.2 What must not require an LLM

| Query class | Expected method |
|-------------|-----------------|
| `movers in Keansburg NJ` | Deterministic + geo |
| `mortgage companies in Florida` | Deterministic + taxonomy |
| `07734 movers` | Zip detect + Move |
| `NMLS lenders Miami-Dade` | Taxonomy + county |
| Obvious hub nouns + one geo | Deterministic |

### 7.3 When LLM assist is appropriate

- Ambiguous consumer language (“someone to redo my kitchen in Fort Lauderdale”)
- Multi-intent queries (“moving to Florida and need a mortgage”) — may emit **primary** search intent + optional journey plan suggestion
- Low-confidence parses

LLM output must be **validated** against allowlisted hubs/entity types/geo codes. Reject invented hubs or free-form provider names as “results.”

### 7.4 Worked examples

**Input:** `movers in Keansburg NJ`

```json
{
  "version": 1,
  "query": "movers in Keansburg NJ",
  "hub": "move",
  "entityType": "mover",
  "journeyKind": "directory",
  "location": {
    "cityName": "Keansburg",
    "stateCode": "NJ",
    "stateSlug": "new-jersey",
    "precision": "city"
  },
  "parseMethod": "deterministic",
  "confidence": "high"
}
```

**Input:** `senior care facility near Austin Texas`

```json
{
  "version": 1,
  "query": "senior care facility near Austin Texas",
  "hub": "senior",
  "entityType": "senior_facility",
  "journeyKind": "senior_care",
  "location": {
    "cityName": "Austin",
    "stateCode": "TX",
    "precision": "city"
  },
  "parseMethod": "taxonomy",
  "confidence": "high"
}
```

**Input:** `someone to redo my kitchen in Fort Lauderdale`

```json
{
  "version": 1,
  "query": "someone to redo my kitchen in Fort Lauderdale",
  "hub": "contractor",
  "entityType": "contractor",
  "category": "kitchen_remodeling",
  "journeyKind": "contractor",
  "location": {
    "citySlug": "fort-lauderdale",
    "cityName": "Fort Lauderdale",
    "stateCode": "FL",
    "precision": "city"
  },
  "parseMethod": "mixed",
  "confidence": "medium"
}
```

### 7.5 Reuse of existing matchers

- Promote `matchSituationFromQuery` / planner matchers into a shared **Intent Lexicon** module.
- Concierge system prompt may call the same structured parser before free-form chat, so chat and search stay consistent.

---

## 8. Search / Ranking Rules

### 8.1 Absolute prohibitions

- Payment-based ranking  
- Premium-account ranking  
- Advertiser preference  
- RAUM / AUM as default Investor ranking (only as **consumer-selected filter** if Hub supports)  
- Google popularity / Places rating as implicit Trust  
- Arbitrary AI “recommended for you” entity lists  

### 8.2 Allowed relevance signals (Ask preview)

| Signal | Use |
|--------|-----|
| Query text ↔ name / search_terms | Primary recall/relevance |
| Entity type / category match | Hard filter then boost |
| Geographic relevance (same city > county > state; service_area hit) | Strong |
| Verified service coverage tokens | Boost when present |
| Regulatory eligibility flag (Hub-authored) | Filter or soft boost — never invent |
| `trust_report_available` | Mild boost for usefulness, **not** a Trust Score |
| Data completeness of discovery fields | Tie-break only |

### 8.3 Separation of concerns (mandatory)

| Concept | Definition | Owner |
|---------|------------|-------|
| **Search relevance** | “Matches what you asked to find” | Ask preview ranker |
| **Trust / regulatory evaluation** | “Evidence about this entity” | Specialist Hub Trust Report |

Ask cards may say “Trust Report available” — they must **not** display a synthetic Ask-computed Trust Score unless the Hub publishes that score as an official field (even then, label Hub ownership).

### 8.4 Independence safeguard checklist

Every ranking change review must answer:

1. Could a paying customer buy a higher slot? → If yes, reject.  
2. Does this use a non-public popularity proxy? → Justify or reject.  
3. Does this conflate relevance with trustworthiness? → Split signals.  

---

## 9. Result Preview Standard

### 9.1 Ask shows (v1)

- Hub chip (Move / Lender / …)
- Entity display name
- Entity type / category label (Carrier, Agency, Facility, …)
- Geo line (city / county / state)
- Optional one-line `regulatory_status_summary`
- “Trust Report available” when true
- Primary CTA: **View Trust Report** → `canonical_profile_url` (+ handoff params)
- Footer CTA: **See all {entities} on {Hub}** → search handoff URL

Approximate count: **5–10** cards. Show total match estimate when known (`About 120 movers` → see all).

### 9.2 Ask must not show

- Full Trust Report sections  
- Complaint dumps / document viewers  
- Calculators embedded as search results  
- “Best / top / #1” language  
- Sibling spam of all six Hubs on every SERP  
- Login walls  

### 9.3 Card minimum fields

```ts
export type AskSearchResultCard = {
  network_entity_id: string;
  hub: SearchHubId;
  display_name: string;
  entity_type_label: string;
  geo_line: string;
  regulatory_status_summary?: string;
  trust_report_available: boolean;
  profile_url: string;
  missing?: Array<'geo' | 'status' | 'categories'>;
};
```

### 9.4 Missing data

- Prefer omit optional lines over “Unknown / N/A” noise.  
- If name + hub + profile URL exist, card is valid.  
- If discovery record lacks geo but query was geo-intent, down-rank or exclude.

### 9.5 Pagination / continuation

- Ask page: single preview page (no deep Ask pagination SEO).  
- Continuation = specialist Hub handoff with same intent.  
- Optional “Load more preview” (next 5) only if index supports offset — still capped; never infinite Ask SERP.

### 9.6 No-result behavior

1. Honest empty state: “No verified {entity} matches in discovery for {place}.”  
2. Offer: open specialist Hub search anyway (handoff with intent).  
3. Offer: broaden geo (state-level) or clarify category.  
4. Never fabricate entities.

### 9.7 Ambiguous-query behavior

- Show clarification chips (hub / city / category).  
- Do not run multi-hub entity mashups that look like one ranked list across industries without labeling.

### 9.8 Multi-intent future teaser (not v1 UI)

If parse detects multi-hub life event, Ask may show a **secondary** module: “Also build a research path” → existing What’s Happening / path generator — separate from entity SERP.

---

## 10. Cross-Domain Handoff Standard

### 10.1 Goals

- Consumer does **not** re-type the search on the specialist Hub.  
- No PII in URLs.  
- Reuse Stage A′ keys; extend carefully.

### 10.2 Recommended handoff query keys

**Existing (keep):**

| Key | Values |
|-----|--------|
| `src` | `ask` |
| `journey` | JourneyKind-compatible |
| `state` | `FL` or slug (prefer code) |
| `county` | slug |
| `intent` | `buy` \| `rent` \| `refi` |

**Search extension (additive):**

| Key | Purpose |
|-----|---------|
| `entity` | `mover`, `lender`, `contractor`, … |
| `category` | trade / product / facility class slug |
| `city` | city slug when Hub routes support it |
| `zip` | 5-digit when Hub routes support it |
| `q` | optional short normalized query token string — **avoid raw user PII**; prefer structured keys |
| `sid` | optional opaque Ask search session id (non-PII random) for analytics join |

### 10.3 Example

Ask query: `movers in Keansburg NJ`  
User clicks “See all movers on MoveTrustHub”:

```text
https://www.movetrusthub.com/local-movers/new-jersey/{county-if-known}
  ?src=ask
  &journey=directory
  &state=NJ
  &city=keansburg
  &entity=mover
```

(Exact path chosen by Move adapter — county resolution may require Hub geo tables.)

Profile click:

```text
https://www.movetrusthub.com/movers/{slug}
  ?src=ask
  &state=NJ
  &entity=mover
```

### 10.4 Specialist requirements

- Parse Stage A′ + search extension params on landing.  
- If params present, **seed** directory/search UI immediately.  
- If path is soft (Contractor/Senior/Investor today), still honor params for client-side seed until deep routes exist.  
- Fail soft: unknown city → state-level results, not 404.

### 10.5 Analytics on handoff

Extend allowlisted `journey_handoff_click` **or** emit `network_search_hub_handoff` with:

`destination_hub`, `entity_type`, `state`, `result_count`, `surface=universal_search`  

No raw query text in analytics if it may contain addresses/names — prefer structured dims + optional hashed query id.

---

## 11. Anonymous + Identity Integration

### 11.1 Anonymous first (required)

Search works with **no login**.  
No login wall on preview or handoff.

### 11.2 Progressive value ladder

```text
Search → Research (Hub) → Compare → Save → Account / sign-in
```

Account appears when **persistence** becomes valuable — not at query submit.

### 11.3 Future one identity / six workspaces

Aligned with Stage B.3 direction:

| Workspace | Hub |
|-----------|-----|
| My Move | MoveTrustHub |
| My Lender / My Lending | LenderTrustHub |
| My Insurance | InsuranceTrustHub |
| My Contractor | ContractorTrustHub |
| My Senior | SeniorTrustHub |
| My Investor | InvestorTrustHub |

**Progressive activation:** emphasize the workspace matching the Hub where the consumer started or last saved — do not dump six empty dashboards.

Ask’s `/my-trust-journey` remains an optional **metadata overview**, not a CRM of Hub workspace contents.

### 11.4 SSO note

Preserve existing Move ↔ Lender ↔ Insurance SSO where live.  
Do not block Universal Search on extending SSO to Senior/Investor.

---

## 12. Privacy Model

### 12.1 Compartment rules

| Compartment | Contents | Cross-use |
|-------------|----------|-----------|
| Identity | Auth subject (future) | Shared login ≠ shared inferences |
| Search history | Queries / intents on Ask | Aggregate analytics OK; no auto Hub personalization across verticals |
| Hub workspace | Shortlists, docs, calcs | Stay on Hub origin unless user explicitly exports/saves cross-Hub |
| Saved entities | Hub-scoped saves | Cross-Hub journey pack only via explicit “save journey” action |
| Documents | Hub/user docs | Never used to rank other Hub search |
| Calculators | Hub tool state | Isolated |
| Cross-Hub journeys | B.2/B.3 metadata | Non-PII geo/intent only |

### 12.2 Explicit prohibitions

- Senior activity must **not** silently influence Investor recommendations.  
- Lender research must **not** silently alter Insurance result ranking.  
- Sensitive context sharing across Hubs requires **clear consumer action**.

### 12.3 Search analytics privacy

- Prefer structured dimensions (hub, entity_type, state, parse_method, result_count).  
- Do not log full street addresses, names, emails, phones.  
- Raw query storage: minimize; retention-limited; never send to specialist analytics joined to identity without policy review.

---

## 13. Analytics / Event Contract

### 13.1 New events (recommended)

| Event | When |
|-------|------|
| `network_search_submitted` | User submits query |
| `network_search_parsed` | Intent produced (include parse_method, confidence) |
| `network_search_results_viewed` | Preview rendered |
| `network_search_no_results` | Empty preview |
| `network_search_hub_handoff` | See-all or card → Hub |
| `network_entity_opened` | Profile CTA |
| `network_search_saved` | Future save |
| `network_search_compare_started` | Future compare |

### 13.2 Dimensions (allowlisted)

```text
hub
entity_type
category
state
county
result_count
query_parse_method
confidence
destination_hub
source_surface   // hero_search | network_page | concierge | …
```

### 13.3 Compatibility

Keep existing:

- `concierge_open` / `concierge_submit`  
- `outbound_hub_click`  
- `journey_handoff_click`  

Universal Search events are additive; Concierge remains distinct unless it explicitly triggers a search parse.

### 13.4 Learning goals

The telemetry must answer:

- What people search for (structured dims)  
- Which Hubs receive handoff traffic  
- Which searches fail (no results / low confidence)  
- Which entity types get opened  
- Which searches lead to saves/compares (later)  
- Which journeys cross Hubs (join with B.2/B.3)

---

## 14. SEO / Indexation Rules

### 14.1 Hard rules

1. **Do not** mass-index thin Ask pages like `/movers/keansburg-nj`, `/contractors/miami-fl`, `/senior/austin-tx` that compete with specialist local SEO.  
2. Specialist Hubs remain responsible for programmatic/local SEO and canonical profile URLs.  
3. Ask search result experiences should be **`noindex,follow`** (or equivalent) when driven by query parameters / session search.  
4. Do not turn Stage A′ / search query parameters into SEO landing pages on Ask.  
5. Do not create `asktrusthub.com/{specialist}` directory trees as replacements for specialist domains.

### 14.2 Sensible Ask surfaces (indexable)

| Surface | Index? |
|---------|--------|
| `/` with search entry UI | Yes (existing) |
| Editorial `/journeys`, `/guides`, `/network` | Yes |
| Ephemeral `/search?q=…` results | **noindex** |
| Entity preview permalinks on Ask | **Do not create** in v1 |

### 14.3 Canonical destinations

- Card profile links → **specialist** `canonical_profile_url`  
- See-all → **specialist** search/directory URL  
- Ask never claims to be the canonical entity page

---

## 15. Scaling Architecture

### 15.1 Adding Hub N

1. Network contract + registry entry  
2. `HubSearchAdapter` registration  
3. Discovery schema mapping + publisher  
4. Taxonomy entries (entity types, categories)  
5. Handoff URL builder  
6. Feature flag: preview enabled  
7. Analytics hub dimension automatically accepts new id via registry  

No changes to ranking core beyond taxonomy config.

### 15.2 Multi-region / international (future)

Keep `stateCode` US-centric in v1; introduce `country` later without breaking v1 records (`discovery_schema_version` bump).

### 15.3 Performance targets (guidance, not SLOs yet)

| Step | Target guidance |
|------|-----------------|
| Deterministic parse | < 20ms in-process |
| Discovery query | < 150ms p95 Ask-side |
| Preview render | First contentful cards < 1s on broadband |
| Federated live enrich (optional) | Budgeted parallel; timeout → index-only |

---

## 16. Risks and Open Questions

| # | Item | Why it matters | Suggested resolution path |
|---|------|----------------|---------------------------|
| 1 | Discovery publish pipeline ownership | Who runs export jobs — Ask infra vs each Hub CI? | Prefer **Hub-owned publish** to Ask sink; Ask validates schema |
| 2 | Geo resolution quality (Keansburg → county) | Soft without shared gazetteer | Start with Hub-assisted city/county tables; no Places |
| 3 | Contractor/Senior/Investor soft handoffs | Preview blocked until Hub search URLs exist | Ship parse+handoff first; enable cards per Hub readiness |
| 4 | Dual situation taxonomies | Confusion / drift | Unify under Intent Lexicon in ASK-SEARCH-002 prep |
| 5 | Index hosting | Ask currently has no DB | Choose managed search/Postgres in implementation task — **not in this doc’s deploy** |
| 6 | Raw query retention | Privacy vs product learning | Default: structured dims only; raw query opt-in policy later |
| 7 | Multi-intent queries | Could bloat v1 | v1 = single primary hub search; suggest journey planner separately |
| 8 | Loan officer / agent person entities | PII-adjacent | Only if Hub already public-pages them; else firm/agency only |
| 9 | Stale regulatory_status_summary | Trust risk | Short TTL messaging (“Based on Hub data as of …”) optional on card |
| 10 | Existing Concierge vs Search UX | Two entry points | Shared parser; distinct UI modes |

**None of these block publishing this architecture.**  
They block or shape **later implementation tasks**, not ASK-SEARCH-001.

---

## 17. Recommended Implementation Sequence

> Do **not** implement these in ASK-SEARCH-001.

| Task ID | Scope | Notes |
|---------|-------|-------|
| **ASK-SEARCH-002** | Intent lexicon + deterministic parser + geo helpers | Pure Ask; no Hub DB |
| **ASK-SEARCH-003** | Search intent TypeScript module + unit fixtures (examples in §7) | Contracts only / library |
| **ASK-SEARCH-004** | Hub adapter descriptors + handoff URL extension (`entity`,`category`,`city`,`zip`) | Docs + Ask builders; Hub parse later |
| **ASK-SEARCH-005** | Discovery schema finalization + sample fixtures per Hub | Still no prod migration unless separately approved |
| **ASK-SEARCH-006** | Move discovery publish pilot + Ask index sink | First Hub end-to-end |
| **ASK-SEARCH-007** | Ask Universal Search UI (hero/network) + preview cards + noindex SERP | Product surface |
| **ASK-SEARCH-008** | Analytics events `network_search_*` | Extend allowlists |
| **ASK-SEARCH-009** | Lender + Insurance discovery enablement | Repeat adapter pattern |
| **ASK-SEARCH-010** | Contractor / Senior / Investor deep handoff + discovery | After Hub URL readiness |
| **ASK-SEARCH-011** | Ambiguity UX + multi-intent → journey planner bridge | Soft coupling to B.2 |
| **ASK-SEARCH-012** | Save/compare hooks into account ladder | After identity posture ready |

---

## Appendix A — Experience acceptance narrative

```text
ASKTRUSTHUB
"What are you looking for?"
> movers in Keansburg NJ
        ↓
Ask understands: Mover + Keansburg + New Jersey
        ↓
TrustHub verified discovery results (Move corpus)
        ↓
5–10 useful Ask preview results
        ↓
"See all movers on MoveTrustHub"
        ↓
MoveTrustHub opens matching Keansburg / county experience
        ↓
Research → Compare → Save → My Move
```

Same architecture path for Lender, Insurance, Contractor, Senior, Investor — **one** Ask search system, **N** Hub adapters.

---

## Appendix B — Document control

| Field | Value |
|-------|-------|
| ASK-SEARCH-001 | Architecture complete |
| Implementation | Not started |
| Specialist repo edits | None required by this document |
| Production deploy | None |
| Follow-on | ASK-SEARCH-002 (parser / lexicon) |

---

*End of ASK-SEARCH-001 architecture.*
