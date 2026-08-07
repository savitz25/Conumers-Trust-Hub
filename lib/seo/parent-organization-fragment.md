# Reciprocal `parentOrganization` (specialist hubs)

Ask Trust Hub already emits `subOrganization` entries with `parentOrganization` pointing at:

```json
{ "@id": "https://www.asktrusthub.com/#organization" }
```

When ready, each specialist site should embed an Organization schema that includes:

```json
{
  "@type": "Organization",
  "@id": "https://www.{specialist}.com/#organization",
  "name": "{Move|Insurance|Lender} Trust Hub",
  "url": "https://www.{specialist}.com",
  "parentOrganization": {
    "@type": "Organization",
    "@id": "https://www.asktrusthub.com/#organization",
    "name": "Ask Trust Hub",
    "url": "https://www.asktrusthub.com"
  }
}
```

Do not invent separate legal entities. Represent **common ownership** with **separated research and listing order** and **no paid placements**.

Code helper on Ask: `buildParentOrganizationReference()` in `lib/seo/schemas.ts`.
