/** Deterministic query normalization (ASK-SEARCH-003). */

// Note: keep this module dependency-free for easy Node/tsx testing.

const MISSPELLINGS: Array<[RegExp, string]> = [
  [/\bmortage\b/g, 'mortgage'],
  [/\binsurence\b/g, 'insurance'],
  [/\bcontracter(s)?\b/g, 'contractor$1'],
  [/\bassited\b/g, 'assisted'],
  [/\badvisoer\b/g, 'adviser'],
  [/\badviosr\b/g, 'advisor'],
];

/** Normalize consumer query for matching — does not rewrite regulatory display truth. */
export function normalizeQuery(raw: string): string {
  let q = raw.normalize('NFKC').trim().toLowerCase();
  q = q.replace(/[’']/g, "'");
  q = q.replace(/[^\w\s#+.-]/g, ' ');
  q = q.replace(/\s+/g, ' ').trim();
  for (const [re, rep] of MISSPELLINGS) {
    q = q.replace(re, rep);
  }
  // advisor → adviser for matching only (Investor lexicon accepts both)
  q = q.replace(/\badvisors?\b/g, (m) => (m.endsWith('s') ? 'advisers' : 'adviser'));
  return q;
}

export function collapseWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}
