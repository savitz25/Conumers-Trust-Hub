import { ASSERTION_HEADER, boundedBody, signAssertion, type AssertionKey, type Scope } from './service-assertion.ts';
import { ISOLATED_TARGET, SOURCE_PATH, type DeploymentTarget } from './isolated-config.ts';
import { RuntimeError } from './runtime.ts';
import type { ProfileIdentity } from '../contracts/v2-3-profile-save.ts';

/** The one identity grain a Move mover is saved by: hub `move`, class `mover`,
 * native id `usdot-<USDOT number>`. It maps one-to-one onto the network binding
 * (namespace fmcsa.usdot, jurisdiction US, source identifier = the number).
 * Nothing else is ever looked up: no name, slug, email or free-form id. */
export const MOVE_NATIVE_ID = /^usdot-[1-9][0-9]{0,8}$/;
export const MOVE_PROFILE_SLUG = /^[a-z0-9][a-z0-9-]{0,159}$/;
export function supportedMoveProfile(p: unknown): p is ProfileIdentity {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  const v = p as Record<string, unknown>;
  return Object.keys(v).sort().join() === 'hub,nativeId,profileClass' && v.hub === 'move' && v.profileClass === 'mover' &&
    typeof v.nativeId === 'string' && MOVE_NATIVE_ID.test(v.nativeId);
}
/** USDOT number of a supported Move profile, as stored in the binding. */
export const moveSourceIdentifier = (p: ProfileIdentity) => p.nativeId.slice('usdot-'.length);
export type Publication = { identity: ProfileIdentity; canonicalSlug: string; publicationState: 'PUBLISHABLE'; reviewedClass: 'mover'; checkedAt: number };

/** The response is from the exact TLS origin; redirects are forbidden. No user
 * token/cookie is forwarded. Protection bypass, when needed, is scoped here. */
export class SourceChannel {
  readonly key: AssertionKey; readonly bypass?: string; readonly send: typeof fetch; readonly target: DeploymentTarget;
  constructor(key: AssertionKey, bypass?: string, send: typeof fetch = fetch, target: DeploymentTarget = ISOLATED_TARGET) {
    this.key = key; this.bypass = bypass; this.send = send; this.target = target;
  }
  async call(body: unknown, scope: Scope, browser: string, session: string | null = null): Promise<unknown> {
    const bytes = Buffer.from(JSON.stringify(body)), target = this.target.moveOrigin + SOURCE_PATH;
    const response = await this.send(target, { method: 'POST', body: bytes, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json',
        [ASSERTION_HEADER]: signAssertion(this.key, 'ask', target, scope, bytes, browser, session, null, Date.now(), this.target),
        ...(this.bypass ? { 'x-vercel-protection-bypass': this.bypass } : {}) } });
    if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new RuntimeError('unavailable');
    const result = JSON.parse((await boundedBody(response)).toString('utf8'));
    if (result?.ok !== true) throw new RuntimeError('unavailable');
    return result.result;
  }
  /** Fresh publication proof for exactly this profile from Move's own production
   * publication source. Anything but a current PUBLISHABLE mover with the same
   * identity is unavailable. The slug is Move's canonical profile slug. */
  async publication(browser: string, profile: ProfileIdentity): Promise<Publication> {
    if (!supportedMoveProfile(profile)) throw new RuntimeError('unavailable');
    const identity = { hub: profile.hub, nativeId: profile.nativeId, profileClass: profile.profileClass };
    const p = await this.call({ action: 'resolve', profile: identity }, 'source:read', browser) as Publication;
    if (!p || !supportedMoveProfile(p.identity) || p.identity.nativeId !== profile.nativeId ||
      typeof p.canonicalSlug !== 'string' || !MOVE_PROFILE_SLUG.test(p.canonicalSlug) ||
      p.publicationState !== 'PUBLISHABLE' || p.reviewedClass !== 'mover' ||
      !Number.isFinite(p.checkedAt) || p.checkedAt > Date.now() + 2000 || p.checkedAt < Date.now() - 5000) throw new RuntimeError('unavailable');
    return p;
  }
}
