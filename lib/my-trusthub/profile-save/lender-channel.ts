import { ASSERTION_HEADER, boundedBody } from './service-assertion.ts';
import { API_PATH, type DeploymentTarget } from './isolated-config.ts';
import { RuntimeError } from './runtime.ts';
import { LENDER_PRODUCTION_PINS, signLenderAssertion, type LenderPins } from './lender-assertion.ts';
import { LENDER_PROFILE_CLASS, parseLenderNativeId } from './lender-binding.ts';
import { isGuestStageInput, lenderMarketplaceReturnPath, type GuestStageInput } from '../contracts/v2-3-profile-transfer.ts';
import type { ProfileIdentity } from '../contracts/v2-3-profile-save.ts';
import type { AssertionKey, Scope } from './service-assertion.ts';

export const LENDER_SOURCE_PATH = API_PATH + '/source';
const SLUG = /^[a-z0-9][a-z0-9-]{0,159}$/;

export function isLenderMarketplaceIdentity(profile: ProfileIdentity): boolean {
  return profile.hub === 'lender' && profile.profileClass === LENDER_PROFILE_CLASS && parseLenderNativeId(profile.nativeId) !== null;
}

export function isLenderMarketplaceStage(input: unknown): input is GuestStageInput {
  if (!isGuestStageInput(input) || input.sourceHub !== 'lender' || input.version !== 'v2-3/selected-profiles/3') return false;
  const task = input.returnTask;
  if (task.hub !== 'lender' || !isLenderMarketplaceIdentity(task.profile)) return false;
  if (task.returnPath !== lenderMarketplaceReturnPath(task.canonicalSlug) || !SLUG.test(task.canonicalSlug)) return false;
  return input.selected.length === 1 && isLenderMarketplaceIdentity(input.selected[0]!.profile) &&
    input.selected[0]!.profile.nativeId === task.profile.nativeId && input.selected[0]!.localItemId === task.canonicalSlug;
}

export type LenderPublication = {
  identity: ProfileIdentity;
  canonicalSlug: string;
  publicationState: 'PUBLISHABLE';
  reviewedClass: 'marketplace_company';
  checkedAt: number;
};

/** Ask calls Lender. The browser never carries the NMLS or the signing key. */
export class LenderSourceChannel {
  readonly key: AssertionKey;
  readonly send: typeof fetch;
  readonly pins: LenderPins;
  constructor(key: AssertionKey, send: typeof fetch = fetch, pins: LenderPins = LENDER_PRODUCTION_PINS) {
    this.key = key; this.send = send; this.pins = pins;
  }
  async call(body: unknown, scope: Scope, browser: string, session: string | null = null): Promise<unknown> {
    const bytes = Buffer.from(JSON.stringify(body));
    const target = this.pins.lenderOrigin + LENDER_SOURCE_PATH;
    const response = await this.send(target, { method: 'POST', body: bytes, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json',
        [ASSERTION_HEADER]: signLenderAssertion(this.key, 'ask', target, scope, bytes, browser, session, null, Date.now(), this.pins) } });
    if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new RuntimeError('unavailable');
    const result = JSON.parse((await boundedBody(response)).toString('utf8'));
    if (result?.ok !== true) throw new RuntimeError('unavailable');
    return result.result;
  }
  async publication(browser: string, profile: ProfileIdentity): Promise<LenderPublication> {
    if (!isLenderMarketplaceIdentity(profile)) throw new RuntimeError('unavailable');
    const identity = { hub: profile.hub, nativeId: profile.nativeId, profileClass: profile.profileClass };
    const proof = await this.call({ action: 'resolve', profile: identity }, 'source:read', browser) as LenderPublication;
    if (!proof || !isLenderMarketplaceIdentity(proof.identity) || proof.identity.nativeId !== profile.nativeId ||
      typeof proof.canonicalSlug !== 'string' || !SLUG.test(proof.canonicalSlug) ||
      proof.publicationState !== 'PUBLISHABLE' || proof.reviewedClass !== 'marketplace_company' ||
      !Number.isFinite(proof.checkedAt) || proof.checkedAt > Date.now() + 2000 || proof.checkedAt < Date.now() - 5000) throw new RuntimeError('unavailable');
    return proof;
  }
}

/** Production pins only. A preview Move target never gains a Lender origin from this helper. */
export function lenderPinsFor(target: DeploymentTarget): LenderPins | null {
  if (target.kind !== 'production') return null;
  if (target.parentOrigin !== LENDER_PRODUCTION_PINS.parentOrigin) return null;
  return LENDER_PRODUCTION_PINS;
}
