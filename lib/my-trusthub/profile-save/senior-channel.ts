import { ASSERTION_HEADER, boundedBody } from './service-assertion.ts';
import { API_PATH, type DeploymentTarget } from './isolated-config.ts';
import { RuntimeError } from './runtime.ts';
import { SENIOR_PRODUCTION_PINS, signSeniorAssertion, type SeniorPins } from './senior-assertion.ts';
import { SENIOR_PROFILE_CLASS, parseSeniorNativeId } from './senior-binding.ts';
import { isGuestStageInput, v3ReturnPath, type GuestStageInput } from '../contracts/v2-3-profile-transfer.ts';
import type { ProfileIdentity } from '../contracts/v2-3-profile-save.ts';
import type { AssertionKey, Scope } from './service-assertion.ts';

export const SENIOR_SOURCE_PATH = API_PATH + '/source';
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function isSeniorIdentity(profile: ProfileIdentity): boolean {
  return profile.hub === 'senior' && profile.profileClass === SENIOR_PROFILE_CLASS && parseSeniorNativeId(profile.nativeId) !== null;
}

export function isSeniorStage(input: unknown): input is GuestStageInput {
  if (!isGuestStageInput(input) || input.sourceHub !== 'senior' || input.version !== 'v2-3/selected-profiles/3') return false;
  const task = input.returnTask;
  if (!('returnPath' in task) || task.hub !== 'senior' || !isSeniorIdentity(task.profile)) return false;
  if (!SLUG.test(task.canonicalSlug) || task.returnPath !== v3ReturnPath('senior', task.canonicalSlug, task.profile.nativeId)) return false;
  const item = input.selected[0];
  // Exactly one CMS nursing-home facility, and it is the return task. The local
  // item id is the CCN; the slug is navigation only.
  return input.selected.length === 1 && !!item && isSeniorIdentity(item.profile) &&
    item.profile.nativeId === task.profile.nativeId && item.localItemId === task.profile.nativeId &&
    item.profile.profileClass === SENIOR_PROFILE_CLASS;
}

export type SeniorPublication = {
  identity: ProfileIdentity;
  canonicalSlug: string;
  publicationState: 'PUBLISHABLE';
  reviewedClass: typeof SENIOR_PROFILE_CLASS;
  checkedAt: number;
};

/** Ask calls Senior. The browser never carries the signing key, and the CCN it
 * shows is never trusted: Senior re-proves the profile on every call. */
export class SeniorSourceChannel {
  readonly key: AssertionKey;
  readonly send: typeof fetch;
  readonly pins: SeniorPins;
  constructor(key: AssertionKey, send: typeof fetch = fetch, pins: SeniorPins = SENIOR_PRODUCTION_PINS) {
    this.key = key; this.send = send; this.pins = pins;
  }
  async call(body: unknown, scope: Scope, browser: string, session: string | null = null): Promise<unknown> {
    const bytes = Buffer.from(JSON.stringify(body));
    const target = this.pins.seniorOrigin + SENIOR_SOURCE_PATH;
    const response = await this.send(target, { method: 'POST', body: bytes, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json',
        [ASSERTION_HEADER]: signSeniorAssertion(this.key, 'ask', target, scope, bytes, browser, session, null, Date.now(), this.pins) } });
    if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new RuntimeError('unavailable');
    const result = JSON.parse((await boundedBody(response)).toString('utf8'));
    if (result?.ok !== true) throw new RuntimeError('unavailable');
    if (scope === 'source:ack' && result.result?.watchCreated !== false) throw new RuntimeError('unavailable');
    return result.result;
  }
  async publication(browser: string, profile: ProfileIdentity): Promise<SeniorPublication> {
    if (!isSeniorIdentity(profile)) throw new RuntimeError('unavailable');
    const identity = { hub: profile.hub, nativeId: profile.nativeId, profileClass: profile.profileClass };
    const proof = await this.call({ action: 'resolve', profile: identity }, 'source:read', browser) as SeniorPublication;
    if (!proof || !isSeniorIdentity(proof.identity) || proof.identity.nativeId !== profile.nativeId ||
      typeof proof.canonicalSlug !== 'string' || !SLUG.test(proof.canonicalSlug) ||
      proof.publicationState !== 'PUBLISHABLE' || proof.reviewedClass !== SENIOR_PROFILE_CLASS ||
      !Number.isFinite(proof.checkedAt) || proof.checkedAt > Date.now() + 2000 || proof.checkedAt < Date.now() - 5000) throw new RuntimeError('unavailable');
    return proof;
  }
}

/** Production pins only. A preview target never gains a Senior origin from this helper. */
export function seniorPinsFor(target: DeploymentTarget): SeniorPins | null {
  if (target.kind !== 'production') return null;
  if (target.parentOrigin !== SENIOR_PRODUCTION_PINS.parentOrigin) return null;
  return SENIOR_PRODUCTION_PINS;
}
