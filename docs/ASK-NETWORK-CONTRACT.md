# Ask Trust Hub — Network V2 Contract

**Version:** `2026.08.18-network-v2`  
**Canonical owner:** `savitz25/Conumers-Trust-Hub` (this repository)  
**Production parent:** https://www.asktrusthub.com  
**Status:** Source of truth for specialist-repo parity (Prompt 2)

This file is the Network V2 contract. Specialist repositories copy the checked-in registry; they must **not** fetch network configuration from Ask at runtime.

---

## 1. Philosophy

**We cite. You decide.**

- Evidence before recommendation.
- Prefer public / official sources where available.
- No paid placements. Research and listing order are not for sale.
- Missing evidence does not mean a clean record.
- Evidence scope differs by vertical. Do not imply one evidence model.
- Ask is a **thin parent**: it routes consumers to specialists.
- Specialist hubs perform the deep research.
- Ask does **not** host provider directories and is **not** a lead marketplace.

---

## 2. Canonical hub IDs

| ID | Role | Public name | Canonical origin |
|----|------|-------------|------------------|
| `ask` | parent | Ask Trust Hub | https://www.asktrusthub.com |
| `move` | specialist | Move Trust Hub | https://www.movetrusthub.com |
| `lender` | specialist | Lender Trust Hub | https://www.lendertrusthub.com |
| `insurance` | specialist | Insurance Trust Hub | https://www.insurancetrusthub.com |
| `contractor` | specialist | Contractor Trust Hub | https://www.contractortrusthub.com |
| `senior` | specialist | SeniorTrustHub | https://www.seniortrusthub.com |
| `investor` | specialist | InvestorTrustHub | https://www.investortrusthub.com |

Typed IDs must stay this closed union. Do not weaken them to `string`.

There are **six specialists** and **one parent**. Prefer durable marketing phrases over hard-coded counts:

- our specialist hubs
- the Ask Trust Hub network
- one research network with specialist domains

---

## 3. Ownership wording

**Short (everywhere):**

> Common ownership · Separated research and listing order · No paid placements

**Long (prose):**

> Move, Lender, Insurance, Contractor, Senior, and Investor Trust Hub are part of the Ask Trust Hub network under common ownership, with separated research and listing order and no paid placements.

Ask is the parent research and standards layer. Specialists are separate product domains, not unrelated companies.

---

## 4. Vertical evidence (live, not future)

| Hub | Evidence orientation (current) |
|-----|--------------------------------|
| Move | FMCSA / SAFER |
| Lender | NMLS / CFPB / FDIC / supported public records |
| Insurance | State DOI / NAIC / supported official records |
| Contractor | State licensing boards — multi-state official-board evidence with **state-specific depth**. Do not claim identical coverage in every state. Do not hard-code a state count. |
| Senior | CMS / supported state regulators. Government-sourced senior care **research**. Not a placement agency, referral marketplace, paid ranking site, or lead-generation service. Do not overclaim national state-regulator coverage. |
| Investor | SEC / IARD investment **firm** research. Tagline: *Research before you invest.* Do **not** claim all brokers, FINRA BrokerCheck people, complete advisor profiles, stock/investment recommendations, or portfolio advice. |

---

## 5. Navigation

- Primary product nav stays vertical on each specialist.
- Network switching is secondary chrome: **Switch Hub ▾**
- Switcher contents, in order: Ask, Move, Lender, Insurance, Contractor, Senior, Investor.
- Mark the current property clearly (not by color alone).
- Do not put six industry pills in every header (no rainbow navbar).
- Use hub accents sparingly.
- Mobile: accessible menu, 44px targets, Escape to close, no stuck body scroll, 0px overflow.

A footer may omit a self-link. The **registry** still knows every property.

---

## 6. Contextual journeys

A cross-hub CTA appears only when the consumer naturally reaches the next decision in the same life event.

**Good:** “You’ve researched financing. Next, understand homeowners coverage.”  
**Bad:** “Also visit InvestorTrustHub!”

Do not spray six sibling cards across every page.

Reasonable journey shapes (do not force every hub into every journey):

- Buying a home: Lender → Insurance → Move if relocating → Contractor if work is needed
- Moving / relocating: Move → Lender if buying → Insurance → Contractor if work is needed
- Helping an aging parent: Senior → Insurance when relevant → Move when relocating → Contractor for aging-in-place modifications
- Retirement / investing: Investor as primary; Senior / Insurance only when a genuine life-decision relationship exists

Never turn Investor journeys into personalized financial recommendations.  
Never turn Senior journeys into placement leads.

---

## 7. Structured data

- Ask is the parent `Organization` (`https://www.asktrusthub.com/#organization`).
- All six specialists are `subOrganization` entries with at least `name` and `url`.
- Each specialist remains its own primary Organization and points `parentOrganization` at Ask.
- Do not add fake ratings, `AggregateRating`, TrustScore, or provider listings.
- Do not change specialist canonicals because of the parent relationship.

---

## 8. SEO invariants

- Do not change specialist domains.
- Do not create `asktrusthub.com/senior` or `/investor` as replacements.
- Do not mass-rewrite titles, create thousands of pages, or add geo farms.
- Do not turn router query parameters into SEO landing pages.
- Do not create keyword-rich cross-link spam.
- Brand anchors only: “SeniorTrustHub”, “InvestorTrustHub” — never “best senior facilities” / “top financial advisers”.
- Permanent production `www.` origins only. No localhost, preview, or obsolete nested paths.

---

## 9. Privacy / PII

Cross-hub URLs may include only bounded, non-PII context such as:

- state
- general intent
- journey ID
- source hub

Never put in cross-hub URLs: names, emails, phones, home addresses, SSNs, health details, investment holdings, or account identifiers.

---

## 10. SSO

Existing Move ↔ Lender ↔ Insurance SSO is preserved where already live.  
Contractor, Senior, and Investor use **direct navigation** unless already safely compatible.  
Do not rebuild auth. Do not automatically extend SSO to Senior or Investor.

---

## 11. Analytics

Outbound hub IDs must include the full Network V2 set.  
Do not send PII in analytics properties.

---

## 12. Cost control

**Google Places API calls for Network V2 work: 0.**

Do not add, enable, or call Places Search, Place Details, Autocomplete, reviews, Photos, or billable Google geocoding/enrichment.  
Do not add any new paid enrichment service.

---

## 13. Rollout / parity

1. Ask (this repo) publishes the contract and parent surfaces.
2. Specialists synchronize a checked-in registry and chrome — one repo at a time.
3. Order: Lender → Move → Insurance → Contractor → Senior → Investor last.

Parity requirement: every repo understands `ask`, `move`, `lender`, `insurance`, `contractor`, `senior`, `investor`.  
Canonical URL mismatches required: **0**.

Code: `lib/network/registry.ts` and `lib/network/standard-version.ts` (`ASK_NETWORK_STANDARD_VERSION` = `2026.08.18-network-v2`).
