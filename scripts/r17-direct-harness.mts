// TH-SEARCH-R1-017: direct-specialist acceptance harness.
// Calls each specialist's own public GET /api/ask contract directly (the same public JSON
// contract the specialist repo documents as its own consumer-facing Ask surface), for every
// corpus entry with 'direct' in testSurfaces. Contractor has no JSON API (HTML /ask only), so
// its direct cases are fetched as HTML and lightly parsed for headline/table presence.
import { readFileSync, writeFileSync } from 'node:fs';

const corpus = JSON.parse(readFileSync('docs/qa/th-search-r1-017/question-corpus.json', 'utf8'));
const entries = corpus.entries.filter((e: any) => e.testSurfaces.includes('direct'));

const API: Record<string, string> = {
  move: 'https://www.movetrusthub.com/api/ask',
  lender: 'https://www.lendertrusthub.com/api/ask',
  insurance: 'https://www.insurancetrusthub.com/api/ask',
  senior: 'https://www.seniortrusthub.com/api/ask',
  investor: 'https://www.investortrusthub.com/api/ask',
};
const CONTRACTOR_ASK = 'https://www.contractortrusthub.com/ask';

async function fetchJson(url: string, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    const status = res.status;
    const body = await res.json().catch(async () => ({ __nonJson: (await res.text()).slice(0, 500) }));
    return { status, body, latencyMs: Date.now() - started };
  } catch (error) {
    return { error: error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : String(error), latencyMs: Date.now() - started };
  } finally { clearTimeout(timer); }
}

async function fetchHtml(url: string, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    return { status: res.status, html: text, latencyMs: Date.now() - started };
  } catch (error) {
    return { error: error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : String(error), latencyMs: Date.now() - started };
  } finally { clearTimeout(timer); }
}

const out: Record<string, unknown>[] = [];
for (const entry of entries) {
  if (entry.hub === 'contractor') {
    const url = `${CONTRACTOR_ASK}?q=${encodeURIComponent(entry.query)}`;
    const result = await fetchHtml(url);
    let extracted: Record<string, unknown> = {};
    if ('html' in result) {
      const h = result.html;
      extracted = {
        title: h.match(/<title>([^<]*)<\/title>/)?.[1],
        headlineGuess: h.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1],
        mentionsNoMatch: /no.{0,20}match|no.{0,20}record/i.test(h),
        approxResultCount: (h.match(/data-result-row|result-card/gi) ?? []).length,
      };
    }
    out.push({ id: entry.id, hub: entry.hub, query: entry.query, surface: 'direct', url, httpStatus: (result as any).status, error: (result as any).error, latencyMs: result.latencyMs, extracted, htmlByteLength: 'html' in result ? result.html.length : undefined });
  } else {
    const url = `${API[entry.hub]}?q=${encodeURIComponent(entry.query)}`;
    const result = await fetchJson(url);
    out.push({ id: entry.id, hub: entry.hub, query: entry.query, surface: 'direct', url, httpStatus: (result as any).status, error: (result as any).error, latencyMs: result.latencyMs, body: (result as any).body });
  }
  process.stderr.write(`done: ${entry.id}\n`);
}
writeFileSync('docs/qa/th-search-r1-017/raw-direct-results.json', JSON.stringify(out, null, 2));
console.log(`wrote ${out.length} direct-surface results`);
