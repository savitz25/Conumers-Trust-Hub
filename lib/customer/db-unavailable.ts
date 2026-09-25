/**
 * ATH-SENTRY-P2 — database-availability failure classification (pure module, no Next.js / no pg import).
 *
 * Classifies provider unavailability from PostgreSQL SQLSTATE classes and Node connection error codes.
 * Exact NEXTJS-3/-4 exception text and request paths were not supplied. This module does not match
 * historical incident sentences. Correlation of those events to a specific message or route is NOT VERIFIED.
 *
 * Class 53 (including 53000) and class 08 are availability failures. Operator shutdown 57P01/57P02/57P03
 * is availability. Query defects are not: 42xxx, 23xxx, 22xxx, 25xxx, 40xxx, 28xxx, and other 57xxx
 * (including 57014 query_canceled) keep their existing semantics.
 */

/** SQLSTATE classes that describe connectivity / resource availability, never query correctness. */
const UNAVAILABLE_SQLSTATE_CLASSES = ['08', '53'] as const;
/** Operator intervention codes that mean the server is going away / not accepting connections. */
const UNAVAILABLE_SQLSTATES = new Set(['57P01', '57P02', '57P03']);
/** Node socket / DNS errnos seen when the provider endpoint is refusing or unreachable. */
const UNAVAILABLE_ERRNOS = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH', 'ECONNABORTED',
]);
/**
 * node-pg / pg-pool library errors that carry no SQLSTATE. These prefixes are the driver's own
 * Error messages, not incident text. Matching is prefix-only so a longer application sentence cannot qualify.
 */
const PG_LIBRARY_CONNECTION_MESSAGES: ReadonlyArray<readonly [string, 'pool_connect_timeout' | 'connection_terminated']> = [
  ['timeout exceeded when trying to connect', 'pool_connect_timeout'],
  ['Connection terminated', 'connection_terminated'],
  ['Connection ended unexpectedly', 'connection_terminated'],
  ['Client has encountered a connection error and is not queryable', 'connection_terminated'],
];

export type DbUnavailableReason =
  | 'sqlstate_08' | 'sqlstate_53' | 'sqlstate_57P0x'
  | 'errno' | 'pool_connect_timeout' | 'connection_terminated';

export type DbErrorClassification = { unavailable: true; reason: DbUnavailableReason; sqlstate: string | null; errno: string | null } | { unavailable: false };

function field(err: unknown, key: string): string | null {
  if (!err || typeof err !== 'object') return null;
  const v = (err as Record<string, unknown>)[key];
  return typeof v === 'string' && v.length > 0 && v.length <= 32 ? v : null;
}

function candidatesOf(err: unknown, depth: number, seen: Set<unknown>): unknown[] {
  if (!err || typeof err !== 'object' || depth > 4 || seen.has(err)) return [];
  seen.add(err);
  const out: unknown[] = [err];
  const record = err as { cause?: unknown; errors?: unknown };
  if (record.cause && typeof record.cause === 'object') out.push(...candidatesOf(record.cause, depth + 1, seen));
  if (Array.isArray(record.errors)) {
    for (const item of record.errors) out.push(...candidatesOf(item, depth + 1, seen));
  }
  return out;
}

/** Narrow classifier. Walks `cause` and `AggregateError.errors` a few levels. Message matching is limited to node-pg library prefixes and never runs for an object that already has a SQLSTATE. */
export function classifyDbError(err: unknown): DbErrorClassification {
  for (const e of candidatesOf(err, 0, new Set())) {
    const code = field(e, 'code');
    const errnoField = field(e, 'errno');
    const sqlstate = code && /^[0-9A-Z]{5}$/.test(code) ? code : null;
    const nodeCode = (code && UNAVAILABLE_ERRNOS.has(code) ? code : null) ?? (errnoField && UNAVAILABLE_ERRNOS.has(errnoField) ? errnoField : null);
    if (sqlstate && UNAVAILABLE_SQLSTATES.has(sqlstate)) return { unavailable: true, reason: 'sqlstate_57P0x', sqlstate, errno: null };
    if (sqlstate && (UNAVAILABLE_SQLSTATE_CLASSES as readonly string[]).includes(sqlstate.slice(0, 2))) {
      return { unavailable: true, reason: sqlstate.startsWith('08') ? 'sqlstate_08' : 'sqlstate_53', sqlstate, errno: null };
    }
    if (nodeCode) return { unavailable: true, reason: 'errno', sqlstate: null, errno: nodeCode };
    if (sqlstate) continue;
    const message = e instanceof Error ? e.message : '';
    for (const [prefix, reason] of PG_LIBRARY_CONNECTION_MESSAGES) {
      if (message.startsWith(prefix)) return { unavailable: true, reason, sqlstate: null, errno: null };
    }
  }
  return { unavailable: false };
}

/**
 * Thrown by the transaction wrapper in place of the raw provider error. The message is fixed and carries no
 * host, URL, SQL or provider text; the original error is kept on `cause` for local diagnostics only.
 */
export class DbUnavailableError extends Error {
  readonly code = 'db_unavailable' as const;
  readonly reason: DbUnavailableReason;
  readonly sqlstate: string | null;
  readonly errno: string | null;
  readonly phase: 'connect' | 'query';
  constructor(input: { reason: DbUnavailableReason; sqlstate: string | null; errno: string | null; phase: 'connect' | 'query'; cause?: unknown }) {
    super(`db_unavailable:${input.reason}`, { cause: input.cause });
    this.name = 'DbUnavailableError';
    this.reason = input.reason; this.sqlstate = input.sqlstate; this.errno = input.errno; this.phase = input.phase;
  }
}

export function isDbUnavailableError(err: unknown): err is DbUnavailableError {
  return err instanceof DbUnavailableError || (!!err && typeof err === 'object' && (err as { code?: unknown }).code === 'db_unavailable' && (err as { name?: unknown }).name === 'DbUnavailableError');
}

/** Response contract for a genuine availability failure. Stable sanitized body in the repo's established `{ ok, error }` shape. */
export const SERVICE_UNAVAILABLE_BODY = { ok: false, error: 'service_unavailable' } as const;
export const SERVICE_UNAVAILABLE_RETRY_AFTER_SECONDS = 30;

export function serviceUnavailableResponse(): Response {
  return Response.json(SERVICE_UNAVAILABLE_BODY, {
    status: 503,
    headers: { 'Cache-Control': 'no-store', 'Retry-After': String(SERVICE_UNAVAILABLE_RETRY_AFTER_SECONDS), 'X-Robots-Tag': 'noindex, nofollow' },
  });
}
