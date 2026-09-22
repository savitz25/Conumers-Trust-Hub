import { ASSERTION_HEADER, boundedBody, signAssertion, type AssertionKey, type Scope } from './service-assertion.ts';
import { MOVE_PREVIEW, SOURCE_PATH } from './isolated-config.ts';
import { RuntimeError } from './runtime.ts';
import type { ProfileIdentity } from '../contracts/v2-3-profile-save.ts';

export const TEST_PROFILE: ProfileIdentity = { hub: 'move', nativeId: 'usdot-1002530', profileClass: 'mover' };
export const TEST_SLUG = 'hindman-isaacs-moving-storage-inc';
export const exactTestProfile = (p: ProfileIdentity) => p.hub === TEST_PROFILE.hub && p.nativeId === TEST_PROFILE.nativeId && p.profileClass === TEST_PROFILE.profileClass;
export type Publication = { identity: ProfileIdentity; canonicalSlug: string; publicationState: 'PUBLISHABLE'; reviewedClass: 'mover'; checkedAt: number };

/** The response is from the exact TLS origin; redirects are forbidden. No user
 * token/cookie is forwarded. Protection bypass, when needed, is scoped here. */
export class SourceChannel {
  readonly key: AssertionKey; readonly bypass?: string; readonly send: typeof fetch;
  constructor(key: AssertionKey, bypass?: string, send: typeof fetch = fetch) { this.key = key; this.bypass = bypass; this.send = send; }
  async call(body: unknown, scope: Scope, browser: string, session: string | null = null): Promise<unknown> {
    const bytes = Buffer.from(JSON.stringify(body)), target = MOVE_PREVIEW + SOURCE_PATH;
    const response = await this.send(target, { method: 'POST', body: bytes, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json',
        [ASSERTION_HEADER]: signAssertion(this.key, 'ask', target, scope, bytes, browser, session),
        ...(this.bypass ? { 'x-vercel-protection-bypass': this.bypass } : {}) } });
    if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new RuntimeError('unavailable');
    const result = JSON.parse((await boundedBody(response)).toString('utf8'));
    if (result?.ok !== true) throw new RuntimeError('unavailable');
    return result.result;
  }
  async publication(browser: string): Promise<Publication> {
    const p = await this.call({ action: 'resolve', profile: TEST_PROFILE }, 'source:read', browser) as Publication;
    if (!p || !p.identity || !exactTestProfile(p.identity) || p.canonicalSlug !== TEST_SLUG ||
      p.publicationState !== 'PUBLISHABLE' || p.reviewedClass !== 'mover' ||
      !Number.isFinite(p.checkedAt) || p.checkedAt > Date.now() + 2000 || p.checkedAt < Date.now() - 5000) throw new RuntimeError('unavailable');
    return p;
  }
}
