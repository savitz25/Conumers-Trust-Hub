export const DBPR_SOURCE_URL = "https://www2.myfloridalicense.com/sto/file_download/extracts//CONSTRUCTIONLICENSE_1.csv";
export type DbprRow = { credential: string; status: string };
export class DbprSourceError extends Error {
  readonly code: "SOURCE_FETCH_FAILED" | "SOURCE_SCHEMA_INVALID" | "SOURCE_IDENTITY_MISSING" | "SOURCE_CLOCK_UNKNOWN";
  constructor(code: DbprSourceError["code"]) { super(code); this.code = code; }
}

// DBPR publishes 21 documented columns plus an empty trailing CSV field.
// Parse complete quoted records; reject unexpected columns, broken quotes, and
// duplicate exact credentials. No numeric-only, name, or company matching.
export function parseDbprExtract(text: string, credentials: string[]): DbprRow[] {
  const wanted = new Set(credentials); const matches = new Map<string, DbprRow>();
  let row: string[] = [], field = "", quoted = false, closed = false, records = 0;
  const finish = () => {
    row.push(field.trim()); field = ""; closed = false;
    if (row.length === 1 && row[0] === "") { row = []; return; }
    if (row.length === 22 && row[21] === "") row.pop();
    if (row.length !== 21 || row[0] !== "06") throw new DbprSourceError("SOURCE_SCHEMA_INVALID");
    records++;
    const occupation = row[1].toUpperCase(); const numeric = row[12].toUpperCase();
    const composed = numeric.startsWith(occupation) ? numeric : occupation + numeric;
    const credential = row[20].toUpperCase().replace(/\s/g, "") || composed;
    if (wanted.has(credential)) {
      if (occupation === "QB" || !numeric || credential !== composed || matches.has(credential)) throw new DbprSourceError("SOURCE_SCHEMA_INVALID");
      const primary = row[13].toUpperCase(), secondary = row[14].toUpperCase();
      // v1 certifies current construction-license flags only. Other regulatory
      // states require review, never an invented 'expired' or reassuring active.
      if (primary !== "C" || !["A", "I", ""].includes(secondary)) throw new DbprSourceError("SOURCE_SCHEMA_INVALID");
      matches.set(credential, { credential, status: secondary === "A" ? "active" : secondary === "I" ? "inactive" : "current" });
    }
    row = [];
  };
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) { if (char === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } } else field += char; continue; }
    if (char === '"') { if (field || closed) throw new DbprSourceError("SOURCE_SCHEMA_INVALID"); quoted = true; }
    else if (char === ",") { row.push(field.trim()); field = ""; closed = false; }
    else if (char === "\n" || char === "\r") { if (char === "\r" && text[i + 1] === "\n") i++; finish(); }
    else { if (closed && char.trim()) throw new DbprSourceError("SOURCE_SCHEMA_INVALID"); field += char; }
  }
  if (quoted) throw new DbprSourceError("SOURCE_SCHEMA_INVALID");
  if (field || row.length) finish();
  if (records < 1000) throw new DbprSourceError("SOURCE_SCHEMA_INVALID");
  if (matches.size !== wanted.size) throw new DbprSourceError("SOURCE_IDENTITY_MISSING");
  return credentials.map((credential) => matches.get(credential)!);
}

export async function fetchDbpr(credentials: string[]) {
  const response = await fetch(DBPR_SOURCE_URL, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(90000) });
  if (!response.ok || !response.headers.get("content-type")?.includes("text/csv")) throw new DbprSourceError("SOURCE_FETCH_FAILED");
  const modified = response.headers.get("last-modified");
  const sourceAsOf = modified && Number.isFinite(Date.parse(modified)) ? new Date(modified).toISOString() : null;
  if (!sourceAsOf) throw new DbprSourceError("SOURCE_CLOCK_UNKNOWN");
  if (Number(response.headers.get("content-length")) > 80000000) throw new DbprSourceError("SOURCE_SCHEMA_INVALID");
  const body = await response.text();
  if (body.length > 80000000) throw new DbprSourceError("SOURCE_SCHEMA_INVALID");
  try { return { rows: parseDbprExtract(body, credentials), sourceAsOf, failure: null }; }
  catch (error) {
    if (error instanceof DbprSourceError) return { rows: [], sourceAsOf, failure: error.code };
    throw error;
  }
}
