import { RuntimeError } from './runtime.ts';
import { PRIVATE_HEADERS } from './http.ts';
import type { PreviewAssembly } from './preview-assembly.ts';
export async function handleCurrentGrant(request: Request, runtime: PreviewAssembly | null, browser: boolean): Promise<Response> {
  try {
    if (!runtime) throw new RuntimeError('unavailable');
    return browser ? await runtime.grants.browser(request) : await runtime.grantService(request);
  } catch (error) {
    const code = error instanceof RuntimeError ? error.code : error instanceof SyntaxError ? 'invalid' : 'unavailable';
    const status = { disabled: 404, unavailable: 503, invalid: 400, unauthorized: 403, expired: 410, conflict: 409, rate_limited: 429 }[code];
    if (!browser) return Response.json({ ok: false, error: code }, { status, headers: PRIVATE_HEADERS });
    return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My TrustHub confirmation unavailable</title><h1>Account confirmation unavailable</h1><p>Return to Move and start a fresh confirmation. Your device copy is retained.</p></html>',
      { status, headers: { ...PRIVATE_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'" } });
  }
}
