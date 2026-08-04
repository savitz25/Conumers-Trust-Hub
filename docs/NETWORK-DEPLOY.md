# Network deploy discipline

**Hard rule:** Production hosts are **not** the same Git repo. Network work that must appear on a domain must land in the repo that Vercel deploys for that domain.

## Production source of truth

| Domain | Production Git repo | Production URL | Vercel must track |
|--------|---------------------|----------------|-------------------|
| `www.asktrusthub.com` | **Conumers-Trust-Hub** (this repo) | https://www.asktrusthub.com | Ask project → this `main` |
| `www.movetrusthub.com` | **Move-trust-Hub** | https://www.movetrusthub.com | Move project → Move `main` |
| `www.insurancetrusthub.com` | **Insurance-trust-hub** | https://www.insurancetrusthub.com | Insurance project → Insurance `main` |
| `www.lendertrusthub.com` | **Lender-Trust-Hub** | https://www.lendertrusthub.com | Lender project → Lender `main` |

## When you change X, push to Y

| Change type | Push to |
|-------------|---------|
| Ask router, Trust Center, Standard, life journeys | **Conumers-Trust-Hub** only |
| Move journey modules, Move chrome, Move methodology | **Move-trust-Hub** |
| Insurance homepage / methodology / journey / seal / meta | **Insurance-trust-hub** |
| Lender homepage / methodology / journey / seal / meta / scores copy | **Lender-Trust-Hub** |
| Shared *idea* (Trust Mark, belonging line, journey label) | **All repos that render it on production** |

- Optional monorepo parity is fine **in addition**, never instead of the standalone production repo.
- **Forbidden assumption:** “It’s in Move monorepo under `app/insurance` so insurancetrusthub.com is updated.” **It is not.**

## Network standard version

Constant: `lib/network/standard-version.ts` → `ASK_NETWORK_STANDARD_VERSION`

- **Bump when:** network bar/seal contract, journey module label API, Trust Mark, belonging line, methodology cross-links
- **Do not bump for:** unrelated vertical content, local SEO pages, data refreshes
- Live hosts expose `data-network-standard` on `<body>` for view-source checks
- **2026.08.06:** ownership clarity — common ownership + separated research (not unaffiliated)

### Ownership (Priority 5)

Short: `Common ownership · Separated research & listing order · No paid placements`  
Long: Move, Insurance, and Lender Trust Hub are part of the Ask Trust Hub network — common ownership, separated research and ordering, no paid placements.

### Hero intent map (Priority 4)

Ask owns **What are you preparing for?** Specialist hubs own: Move *Where are you going?*, Lender *What are you trying to accomplish?*, Insurance *What are you trying to protect?* — vertical copy only; Standard version not bumped for hero-only changes.

### Trust Mark contract (Priority 3)

| Field | Value |
|-------|--------|
| Primary label | `Ask Trust Hub Standard` |
| Long form | `Researched to the Ask Trust Hub Standard` |
| URL | `/methodology` (canonical Standard page) |

Component: `components/trust-mark.tsx`.

## Post-deploy smoke

From **Move-trust-Hub** (canonical script):

```bash
npm run smoke:network
```

Quick curls (any machine):

```bash
curl -sI https://www.asktrusthub.com/methodology
curl -sI https://www.movetrusthub.com/about/how-we-score-movers
curl -sI https://www.insurancetrusthub.com/methodology
curl -sI https://www.lendertrusthub.com/methodology
curl -sI https://www.asktrusthub.com/moving-to
```

Expect methodology paths **200**. Expect Ask `/moving-to` **301/308** toward movetrusthub.com.

See also: [NETWORK-PR-CHECKLIST.md](./NETWORK-PR-CHECKLIST.md)

## Human: verify Vercel Git connections

Agents cannot assume dashboard access. After any multi-domain network work, a human should confirm:

1. Vercel → **Insurance** project → Settings → Git → repo = `Insurance-trust-hub`, branch `main`
2. Vercel → **Lender** project → repo = `Lender-Trust-Hub`, branch `main`
3. Vercel → **Move** project → repo = `Move-trust-Hub`, branch `main`
4. Vercel → **Ask** project → repo = `Conumers-Trust-Hub`, branch `main`
5. Production aliases match `www.asktrusthub.com`, `www.movetrusthub.com`, `www.insurancetrusthub.com`, `www.lendertrusthub.com`

## Future option (out of scope)

Merging Insurance/Lender into a monorepo with multi-project deploy is a process option only — not required for network parity if standalones stay wired correctly.
