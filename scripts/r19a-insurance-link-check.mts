// TH-SEARCH-R1-019A review-1 finding 5: validate Insurance link sanitation against ACTUAL destinations.
// For live hub-supplied selectionUrls: does the raw link open the intended record? Does the sanitized one?
// "Intended record" = the page shows THIS row's NPN. Read-only GETs against the public hub.
import { writeFileSync } from 'node:fs';
import { safeHubUrl } from '../lib/network/name-candidates/adapters.ts';
const C = 'trusthub-specialist-execution-v2';
const out: unknown[] = [];
for (const name of ['allied', 'beacon', 'summit']) {
  const res = await fetch('https://www.insurancetrusthub.com/api/specialist-execution/v2', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contract: C, queryType: 'identity', identityName: name, limit: 10 }) });
  const body = await res.json() as { rows?: Array<Record<string, unknown>> };
  for (const row of (body.rows ?? []).slice(0, 2)) {
    const raw = String(row.selectionUrl ?? ''); const npn = String(row.npn ?? ''); if (!raw || !npn) continue;
    const safe = safeHubUrl('insurance', raw);
    const opens = async (url: string) => { const html = await (await fetch(url)).text(); return { showsThisNpn: html.includes(npn), showsRevalidatedIdentity: /Server-revalidated selected source identity/.test(html) }; };
    const rawParams = [...new URL(raw, 'https://www.insurancetrusthub.com').searchParams.entries()];
    const keptParams = safe ? [...new URL(safe.href).searchParams.keys()] : [];
    out.push({ name, record: row.name, npn, rawParams, droppedParams: rawParams.filter(([k]) => !keptParams.includes(k)).map(([k, v]) => `${k}=${v}`), keptParams,
      rawLink: await opens(new URL(raw, 'https://www.insurancetrusthub.com').toString()), sanitizedLink: safe ? await opens(safe.href) : 'NO LINK (required param was broken)' });
  }
}
writeFileSync('docs/qa/th-search-r1-019a/review-1/insurance-link-validation.json', JSON.stringify({ checkedAt: new Date().toISOString(), rows: out }, null, 1));
for (const r of out as Array<Record<string, any>>) console.log(String(r.record).slice(0, 38).padEnd(40), 'dropped:', r.droppedParams.join(',') || '-', '| raw opens record:', r.rawLink.showsThisNpn, '| sanitized opens record:', r.sanitizedLink.showsThisNpn);
