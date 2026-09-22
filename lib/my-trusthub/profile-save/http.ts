import { OPERATIONS, PROFILE_SAVE_RUNTIME_VERSION, type Operation } from './interface.ts';
import { ParentProfileSaveRuntime, RuntimeError } from './runtime.ts';
export const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow, noarchive' };
export type HttpBindings = {
  enabled: boolean;
  /** Must authenticate Origin/CSRF for browser OR narrow BFF service credentials.
   * Produces a runtime with a fresh verified channel, never a request principal. */
  runtimeForRequest(request: Request): Promise<ParentProfileSaveRuntime | null>;
};
const response = (body: unknown, status: number) => Response.json(body, { status, headers: PRIVATE_HEADERS });
export async function handleProfileSave(request: Request, bindings: HttpBindings): Promise<Response> {
  if (!bindings.enabled) return response({ ok: false, error: 'disabled' }, 404);
  if (request.method !== 'POST') return response({ ok: false, error: 'invalid' }, 405);
  if (new URL(request.url).search || request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
    return response({ ok: false, error: 'invalid' }, 400);
  try {
    const reader = request.body?.getReader();
    if (!reader) return response({ ok: false, error: 'invalid' }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 65_536) { await reader.cancel(); return response({ ok: false, error: 'invalid' }, 413); }
        chunks.push(chunk.value);
      }
    } finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks);
    const runtime = await bindings.runtimeForRequest(new Request(request.url, {method:request.method,headers:request.headers,body:bytes,signal:request.signal}));
    if (!runtime) return response({ ok: false, error: 'unavailable' }, 503);
    let envelope: unknown;
    try { envelope = JSON.parse(bytes.toString('utf8')); }
    catch { return response({ ok: false, error: 'invalid' }, 400); }
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return response({ ok: false, error: 'invalid' }, 400);
    const e = envelope as Record<string, unknown>;
    if (Object.keys(e).length !== 3 || !Object.hasOwn(e, 'input') ||
        e.version !== PROFILE_SAVE_RUNTIME_VERSION || !OPERATIONS.includes(e.operation as Operation))
      return response({ ok: false, error: 'invalid' }, 400);
    const result = await runtime.execute(e.operation as Operation, e.input);
    return response({ ok: true, operation: e.operation, result }, 200);
  } catch (error) {
    const code = error instanceof RuntimeError ? error.code : error instanceof SyntaxError ? 'invalid' : 'unavailable';
    const status = { disabled: 404, unavailable: 503, invalid: 400, unauthorized: 403, expired: 410, conflict: 409, rate_limited: 429 }[code];
    return response({ ok: false, error: code }, status);
  }
}
