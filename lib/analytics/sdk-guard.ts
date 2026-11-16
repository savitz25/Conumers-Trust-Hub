/**
 * Blocks or sanitizes browser calls to PostHog ingest. Other hosts pass through.
 * Installed on import in the browser so a direct posthog-js call cannot skip it.
 */
import { shouldEnablePosthog } from './environment.ts';
import { sanitizeCaptureEnvelope } from './privacy.ts';
import { TRUSTHUB_EVENTS } from './trusthub-events.ts';

const KNOWN_POSTHOG_HOSTS = new Set([
  'us.i.posthog.com',
  'us.posthog.com',
  'eu.i.posthog.com',
  'eu.posthog.com',
  'app.posthog.com',
]);

const ANALYTICS_PATH = /\/(?:flags|decide|e|capture|batch|engage|s|config)(?:\/|$)|\/i\/v|\/array\//i;
const EMAIL_SHAPED = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const ALLOWED_EVENTS = new Set<string>(Object.values(TRUSTHUB_EVENTS));

let installed = false;

function configuredHost(): string | null {
  try {
    const raw = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!raw) return null;
    return new URL(raw).host;
  } catch {
    return null;
  }
}

export function isPosthogAnalyticsDestination(raw: string): boolean {
  if (!raw) return false;
  try {
    const base = typeof window !== 'undefined' && window.location?.href ? window.location.href : 'https://collector.invalid';
    const url = new URL(raw, base);
    const known = KNOWN_POSTHOG_HOSTS.has(url.host) || url.host === configuredHost() || url.host.endsWith('.i.posthog.com');
    if (!known) return false;
    return ANALYTICS_PATH.test(url.pathname);
  } catch {
    return false;
  }
}

function emptyAnalyticsResponse(): Response {
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
}

export function sanitizeAnalyticsRequestBody(body: string): string | null {
  try {
    const encoded = JSON.stringify(sanitizeCaptureEnvelope(JSON.parse(body), ALLOWED_EVENTS));
    if (EMAIL_SHAPED.test(encoded) || /PRIVATE_/i.test(encoded)) return null;
    return encoded;
  } catch {
    return null;
  }
}

function finishBlockedRequest(xhr: XMLHttpRequest): void {
  queueMicrotask(() => {
    try {
      Object.defineProperty(xhr, 'readyState', { configurable: true, get: () => 4 });
      Object.defineProperty(xhr, 'status', { configurable: true, get: () => 200 });
      Object.defineProperty(xhr, 'responseText', { configurable: true, get: () => '{}' });
      Object.defineProperty(xhr, 'response', { configurable: true, get: () => '{}' });
      xhr.dispatchEvent(new Event('readystatechange'));
      xhr.dispatchEvent(new Event('load'));
      xhr.dispatchEvent(new Event('loadend'));
    } catch {
      /* already stopped */
    }
  });
}

type SavedAnalyticsTransport = {
  fetch: typeof window.fetch | null;
  xhrOpen: typeof XMLHttpRequest.prototype.open | null;
  xhrSend: typeof XMLHttpRequest.prototype.send | null;
  beacon: typeof navigator.sendBeacon | null;
};

function readSavedTransport(): SavedAnalyticsTransport | null {
  const carrier = window as Window & { __TRUSTHUB_ANALYTICS_TRANSPORT?: SavedAnalyticsTransport };
  return carrier.__TRUSTHUB_ANALYTICS_TRANSPORT ?? null;
}

/** Drop PostHog analytics traffic while the gate is closed. Sanitize it if the gate is open. */
export function installAnalyticsTransportGuard(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const saved = readSavedTransport();
  const originalFetch = saved?.fetch ?? window.fetch.bind(window);
  const requestUrl = (input: RequestInfo | URL): string => {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return input.url;
  };

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const target = requestUrl(input);
    if (!isPosthogAnalyticsDestination(target)) return originalFetch(input, init);
    if (!shouldEnablePosthog()) return Promise.resolve(emptyAnalyticsResponse());
    const body = init?.body;
    if (typeof body !== 'string') return Promise.resolve(emptyAnalyticsResponse());
    const next = sanitizeAnalyticsRequestBody(body);
    if (next == null) return Promise.resolve(emptyAnalyticsResponse());
    return originalFetch(target, { ...init, body: next });
  };

  const gate = window as Window & { __TRUSTHUB_ANALYTICS_GATE?: 'open' | 'closed' };
  gate.__TRUSTHUB_ANALYTICS_GATE = shouldEnablePosthog() ? 'open' : 'closed';

  if (typeof XMLHttpRequest === 'undefined') return;
  const xhrProto = XMLHttpRequest.prototype;
  const originalOpen = saved?.xhrOpen ?? xhrProto.open;
  const originalSend = saved?.xhrSend ?? xhrProto.send;
  xhrProto.open = function open(this: XMLHttpRequest, method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null): void {
    const record = this as XMLHttpRequest & { __trusthubUrl?: string; __trusthubBlock?: boolean };
    const raw = String(url ?? '');
    record.__trusthubUrl = raw;
    record.__trusthubBlock = isPosthogAnalyticsDestination(raw) && !shouldEnablePosthog();
    originalOpen.call(this, method, raw, async ?? true, username ?? null, password ?? null);
  } as typeof xhrProto.open;
  xhrProto.send = function send(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
    const record = this as XMLHttpRequest & { __trusthubUrl?: string; __trusthubBlock?: boolean };
    if (record.__trusthubBlock || (record.__trusthubUrl && isPosthogAnalyticsDestination(record.__trusthubUrl) && !shouldEnablePosthog())) {
      finishBlockedRequest(this);
      return;
    }
    if (record.__trusthubUrl && isPosthogAnalyticsDestination(record.__trusthubUrl)) {
      if (typeof body !== 'string') {
        finishBlockedRequest(this);
        return;
      }
      const next = sanitizeAnalyticsRequestBody(body);
      if (next == null) {
        finishBlockedRequest(this);
        return;
      }
      originalSend.call(this, next);
      return;
    }
    originalSend.call(this, body ?? null);
  } as typeof xhrProto.send;

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const originalBeacon = saved?.beacon ?? navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null): boolean => {
      const target = String(url);
      if (!isPosthogAnalyticsDestination(target)) return originalBeacon(url, data);
      if (!shouldEnablePosthog()) return true;
      if (typeof data !== 'string') return true;
      const next = sanitizeAnalyticsRequestBody(data);
      if (next == null) return true;
      return originalBeacon(target, next);
    };
  }
}
