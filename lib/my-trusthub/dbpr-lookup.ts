// Public official source adapter. Imported only by the server scheduler.
// No company-name matching, numeric-core matching, or status inference from bulk absence.
export const DBPR_LOOKUP_ORIGIN = "https://www.myfloridalicense.com";
export const DBPR_LOOKUP_SCHEMA = "contractor.fl.dbpr.license_status/v2";
export const DBPR_LOOKUP_CONSENT = "dbpr-exact-lookup-v2/2026-09-10";
export type LookupFailure = "SOURCE_FETCH_FAILED" | "SOURCE_SCHEMA_INVALID" | "SOURCE_IDENTITY_MISSING" | "SOURCE_IDENTITY_AMBIGUOUS";
export class DbprLookupError extends Error {
  readonly code: LookupFailure;
  constructor(code: LookupFailure) { super(code); this.code = code; }
}
export type DbprLookupObservation = {
  credential: string;
  primary_status: string;
  secondary_status: string;
  official_status: string;
  source_url: string;
  source_as_of: null;
  retrieved_at: string;
};

function plain(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&(?:amp|#38);/gi, "&")
    .replace(/&(?:nbsp|#160);/gi, " ").replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, decimal) => {
      const code = Number.parseInt(hex || decimal, hex ? 16 : 10);
      return code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }).replace(/\s+/g, " ").trim();
}

export function parseDbprSearch(html: string, credential: string): string {
  const ids = new Set<string>();
  // DBPR can show both primary-name and DBA rows for one identical license detail.
  const pattern = /<a\b[^>]*href=['"]LicenseDetail\.asp\?SID=[^'"&]*&(?:amp;)?id=([A-F0-9]{16,128})['"][^>]*>[^<]*<\/a><\/font><\/td>\s*<td[^>]*><font[^>]*>[^<]*<\/font><\/td>\s*<td[^>]*><font[^>]*>([^<]*)<br\s*\/?\s*>/gi;
  for (const match of html.matchAll(pattern)) {
    if (plain(match[2]).replace(/\s/g, "").toUpperCase() === credential) ids.add(match[1].toUpperCase());
  }
  if (ids.size > 1) throw new DbprLookupError("SOURCE_IDENTITY_AMBIGUOUS");
  if (!ids.size) throw new DbprLookupError(html.includes("hLicNbr") ? "SOURCE_IDENTITY_MISSING" : "SOURCE_SCHEMA_INVALID");
  return [...ids][0];
}

function detailField(html: string, id: string) {
  const fields = [...html.matchAll(new RegExp(`<label\\b[^>]*for=["']${id}["'][^>]*>[^<]*<\\/label>\\s*<div\\b[^>]*>([\\s\\S]*?)<\\/div>`, "gi"))];
  if (fields.length !== 1) throw new DbprLookupError("SOURCE_SCHEMA_INVALID");
  return plain(fields[0][1]);
}

export function normalizeDbprLookupStatus(status: string) {
  const values = status.split(",").map(value => value.trim().toLowerCase().replace(/\s+/g, " "));
  if (values.length > 2 || !values[0]) throw new DbprLookupError("SOURCE_SCHEMA_INVALID");
  const primary: Record<string, string> = {
    current: "current", delinquent: "delinquent", "null & void": "null_and_void", "null and void": "null_and_void",
    "involuntary inactive": "involuntarily_inactive", "involuntarily inactive": "involuntarily_inactive",
  };
  const secondary: Record<string, string> = {
    active: "active", inactive: "inactive", "voluntary inactive": "voluntarily_inactive",
    "voluntarily inactive": "voluntarily_inactive", "involuntary inactive": "involuntarily_inactive",
    "involuntarily inactive": "involuntarily_inactive",
  };
  if (!primary[values[0]] || (values.length === 2 && !secondary[values[1]])) throw new DbprLookupError("SOURCE_SCHEMA_INVALID");
  return { primary_status: primary[values[0]], secondary_status: values.length === 1 ? "not_reported" : secondary[values[1]] };
}

export function parseDbprDetail(html: string, credential: string) {
  if (detailField(html, "LicenseNumber").replace(/\s/g, "").toUpperCase() !== credential) throw new DbprLookupError("SOURCE_IDENTITY_MISSING");
  const official_status = detailField(html, "LicStatus");
  if (!official_status || official_status.length > 120) throw new DbprLookupError("SOURCE_SCHEMA_INVALID");
  return { credential, ...normalizeDbprLookupStatus(official_status), official_status };
}

export async function fetchDbprLookup(credential: string, signal?: AbortSignal): Promise<DbprLookupObservation> {
  if (!/^[A-Z]{3}\d{7}$/.test(credential)) throw new DbprLookupError("SOURCE_IDENTITY_MISSING");
  const cookies = new Map<string, string>();
  const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000);
  let lastRequest = 0;
  const request = async (pathname: string, form?: URLSearchParams) => {
    // A bounded public lookup, with at least one second between DBPR requests.
    const delay = 1000 - (Date.now() - lastRequest);
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    let url = new URL(pathname, DBPR_LOOKUP_ORIGIN);
    let method = form ? "POST" : "GET";
    let body = form?.toString();
    for (let redirects = 0; redirects <= 3; redirects++) {
      if (url.origin !== DBPR_LOOKUP_ORIGIN || !/^\/(?:wl11\.asp|portalsearches\/VerifyLicensee(?:\/[^/?]+)?)$/i.test(url.pathname)) throw new DbprLookupError("SOURCE_FETCH_FAILED");
      const response = await fetch(url, { method, body, redirect: "manual", cache: "no-store", signal: deadline,
        headers: { Accept: "text/html", "User-Agent": "TrustHub-LicenseWatch/2 (daily exact public license lookup)",
          ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
          ...(cookies.size ? { Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") } : {}) } });
      lastRequest = Date.now();
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(";", 1)[0]; const split = pair.indexOf("=");
        if (split > 0) cookies.set(pair.slice(0, split), pair.slice(split + 1));
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const destination = response.headers.get("location"); await response.body?.cancel();
        if (!destination || redirects === 3) throw new DbprLookupError("SOURCE_FETCH_FAILED");
        url = new URL(destination, url);
        if ([301, 302, 303].includes(response.status)) { method = "GET"; body = undefined; }
        continue;
      }
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) { await response.body?.cancel(); throw new DbprLookupError("SOURCE_FETCH_FAILED"); }
      if (Number(response.headers.get("content-length")) > 2000000) { await response.body?.cancel(); throw new DbprLookupError("SOURCE_SCHEMA_INVALID"); }
      const reader = response.body?.getReader();
      if (!reader) throw new DbprLookupError("SOURCE_FETCH_FAILED");
      const decoder = new TextDecoder(); let text = "", bytes = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 2000000) throw new DbprLookupError("SOURCE_SCHEMA_INVALID");
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      } finally { await reader.cancel(); }
      return text;
    }
    throw new DbprLookupError("SOURCE_FETCH_FAILED");
  };
  try {
    await request("/wl11.asp?mode=1&search=LicNbr&SID=");
    const search = await request("/wl11.asp?mode=2&search=LicNbr&SID=&brd=&typ=", new URLSearchParams({
      hSID: "", hSearchType: "LicNbr", hLicNbr: credential, hDivision: "ALL", hBoard: "06", hRecsPerPage: "20",
      LicNbr: credential, Board: "06", RecsPerPage: "20", Search1: "Search",
    }));
    const id = parseDbprSearch(search, credential);
    const source_url = `${DBPR_LOOKUP_ORIGIN}/portalsearches/VerifyLicensee/LicenseDetail?ID=${id}`;
    const detail = await request(source_url);
    // The portal's rendered wall clock is not a record-publication timestamp.
    return { ...parseDbprDetail(detail, credential), source_url, source_as_of: null, retrieved_at: new Date().toISOString() };
  } catch (error) {
    throw error instanceof DbprLookupError ? error : new DbprLookupError("SOURCE_FETCH_FAILED");
  }
}
