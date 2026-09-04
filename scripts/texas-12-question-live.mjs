#!/usr/bin/env node
/**
 * ATH-TX-002 12-question Texas live stress test.
 * Records classified hub, state, destination, and source caveat.
 * Live HTTP 200 through Ask /ask is only meaningful after production publish.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rows = JSON.parse(readFileSync(join(root, 'data/network/texas-12-question-stress.json'), 'utf8'));
const origin = process.env.ASK_ORIGIN || 'https://www.asktrusthub.com';

const results = [];
for (const row of rows) {
  const url = `${origin}/ask?q=${encodeURIComponent(row.question)}`;
  let http_status = null;
  let ok = false;
  let error = null;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    http_status = res.status;
    ok = res.status === 200;
  } catch (err) {
    error = String(err);
  }
  results.push({
    question: row.question,
    classified_hub: row.classified_hub,
    state: row.state,
    destination: row.destination,
    source_caveat: row.source_caveat,
    ask_url: url,
    http_status,
    ok,
    error,
  });
  console.log(
    `${ok ? 'OK' : 'FAIL'} ${http_status ?? 'ERR'} ${row.classified_hub.padEnd(12)} ${row.question}`,
  );
}

const passed = results.every((r) => r.ok);
const out = {
  verified_at: new Date().toISOString(),
  origin,
  passed,
  results,
};
writeFileSync(join(root, 'data/network/texas-12-question-live.json'), JSON.stringify(out, null, 2) + '\n');
console.log(passed ? '12-QUESTION LIVE PASS' : '12-QUESTION LIVE FAIL');
if (!passed) process.exitCode = 2;
