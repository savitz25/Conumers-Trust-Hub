// TH-SEARCH-R1-019A: draw and FREEZE a reproducible 20-record holdout per enabled hub from the hub's
// own eligible public cohort operation, at fixed (scope, page, row) positions chosen before any
// matching is looked at. The draw never consults Ask's parser or name decision.
import { writeFileSync } from 'node:fs';
const C = 'trusthub-specialist-execution-v2';
const post = async (url: string, body: unknown) => { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})) as Body }; };
type Row = Record<string, unknown>; type Body = Record<string, unknown> & { rows?: Row[]; resultState?: string; resultType?: string; status?: string };
const str = (v: unknown) => (typeof v === 'string' ? v : '');
type Draw = { hub: string; scope: string; page: number; row: number; key: string; name: string };
const PAGES = [2, 7]; const ROWS = [0, 2, 4, 6, 8];

const plans: Record<string, { url: string; scopes: string[]; pages?: number[]; body: (scope: string, page: number) => unknown; rows: (b: Body) => Array<{ key: string; name: string }> }> = {
  move: { url: 'https://www.movetrusthub.com/api/specialist-execution/v2', scopes: ['TX', 'OH'],
    body: (s, page) => ({ contract: C, queryType: 'cohort', entityClass: 'mover', geography: { stateCode: s, intent: 'RECORDED_HQ' }, page, limit: 10 }),
    rows: (b) => (b.rows ?? []).map((r) => ({ key: `slug:${str(r.canonicalSlug)}`, name: str(r.publicDisplayName) })) },
  investor: { url: 'https://www.investortrusthub.com/api/specialist-execution/v2', scopes: ['TX', 'OH'],
    body: (s, page) => ({ contract: C, queryType: 'cohort', entityClass: 'ria_and_era', geography: { stateCode: s, intent: 'PRINCIPAL_OFFICE' }, page, limit: 10 }),
    rows: (b) => (b.rows ?? []).map((r) => ({ key: `crd:${str(r.crd)}`, name: str(r.firmName) || str(r.legalName) })) },
  insurance: { url: 'https://www.insurancetrusthub.com/api/specialist-execution/v2', scopes: ['FL', 'TX'],
    body: (s, page) => ({ contract: C, queryType: 'cohort', entityClass: 'agency', geography: { stateCode: s, intent: 'CREDENTIAL_JURISDICTION' }, page, limit: 10 }),
    rows: (b) => (b.rows ?? []).map((r) => ({ key: `npn:${str(r.npn)}`, name: str(r.name) })) },
  lender: { url: 'https://www.lendertrusthub.com/api/specialist-execution/v2', scopes: ['FL', 'TX'],
    body: (s, page) => ({ contract: C, queryType: 'market_cohort', entityClass: 'hmda_reporting_institution', geography: { intent: 'PROPERTY_MARKET', stateCode: s }, action: 'origination', page, limit: 10 }),
    rows: (b) => (b.rows ?? []).map((r) => ({ key: `lei:${str(r.lei)}`, name: str(r.displayName) || str(r.institutionName) })) },
  senior: { url: 'https://www.seniortrusthub.com/api/specialist-execution/v2', scopes: ['Palm Beach|FL', 'Harris|TX', 'Cook|IL', 'Maricopa|AZ'], pages: [2], // county cohorts are small: four counties at page 2
    body: (s, page) => ({ providerClass: 'nursing_home', geography: { type: 'county', value: s.split('|')[0], state: s.split('|')[1] }, page }),
    rows: (b) => (b.rows ?? []).map((r) => ({ key: `ccn:${str(r.cmsCcn)}`, name: str(r.name) })) },
};

const out: Record<string, { drawn: Draw[]; notes: string[] }> = {};
for (const [hub, plan] of Object.entries(plans)) {
  const drawn: Draw[] = []; const notes: string[] = [];
  for (const scope of plan.scopes) for (const page of plan.pages ?? PAGES) {
    const res = await post(plan.url, plan.body(scope, page));
    const rows = plan.rows(res.body);
    if (!rows.length) { notes.push(`${scope} p${page}: status ${res.status} state ${res.body.resultState ?? res.body.resultType ?? res.body.status} rows 0`); continue; }
    for (const row of ROWS) if (rows[row]?.name && rows[row]?.key) drawn.push({ hub, scope, page, row, key: rows[row].key, name: rows[row].name });
  }
  out[hub] = { drawn: drawn.slice(0, 20), notes };
  console.log(hub.padEnd(10), 'drawn:', out[hub].drawn.length, notes.length ? `notes: ${notes.join('; ')}` : '');
}
writeFileSync('docs/qa/th-search-r1-019a/holdout-frozen.json', JSON.stringify({ frozenAt: new Date().toISOString(), method: 'Fixed (scope,page,row) positions from each hub cohort operation; pages [2,7], rows [0,2,4,6,8]; two state scopes per hub (Senior: four county scopes at page 2, because county cohorts have fewer than 7 pages). Drawn before any name matching was evaluated.', hubs: out }, null, 1));
