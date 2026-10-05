import { ASSERTION_HEADER, boundedBody } from './service-assertion.ts';
import { API_PATH, type DeploymentTarget } from './isolated-config.ts';
import { RuntimeError } from './runtime.ts';
import { CONTRACTOR_PRODUCTION_PINS, signContractorAssertion, type ContractorPins } from './contractor-assertion.ts';
import { CONTRACTOR_PROFILE_CLASS, parseContractorNativeId } from './contractor-binding.ts';
import { isGuestStageInput, v3ReturnPath, type GuestStageInput } from '../contracts/v2-3-profile-transfer.ts';
import type { ProfileIdentity } from '../contracts/v2-3-profile-save.ts';
import type { AssertionKey, Scope } from './service-assertion.ts';

export const CONTRACTOR_SOURCE_PATH = API_PATH + '/source';
const SLUG = /^[a-z0-9][a-z0-9-]{0,159}$/;

export function isContractorIdentity(profile: ProfileIdentity): boolean {
  return profile.hub === 'contractor' && profile.profileClass === CONTRACTOR_PROFILE_CLASS && parseContractorNativeId(profile.nativeId) !== null;
}

export function isContractorStage(input: unknown): input is GuestStageInput {
  if (!isGuestStageInput(input) || input.sourceHub !== 'contractor' || input.version !== 'v2-3/selected-profiles/3') return false;
  const task = input.returnTask;
  if (!('returnPath' in task) || task.hub !== 'contractor' || !isContractorIdentity(task.profile)) return false;
  if (!SLUG.test(task.canonicalSlug) || task.returnPath !== v3ReturnPath('contractor', task.canonicalSlug, task.profile.nativeId)) return false;
  const item = input.selected[0];
  return input.selected.length === 1 && !!item && isContractorIdentity(item.profile) &&
    item.profile.nativeId === task.profile.nativeId && item.localItemId === task.canonicalSlug &&
    item.profile.profileClass === CONTRACTOR_PROFILE_CLASS;
}

export type ContractorPublication = {
  identity: ProfileIdentity;
  canonicalSlug: string;
  publicationState: 'PUBLISHABLE';
  reviewedClass: typeof CONTRACTOR_PROFILE_CLASS;
  checkedAt: number;
};

/** Ask calls Contractor. The browser never carries the DBPR key or the signing key. */
export class ContractorSourceChannel {
  readonly key: AssertionKey;
  readonly send: typeof fetch;
  readonly pins: ContractorPins;
  constructor(key: AssertionKey, send: typeof fetch = fetch, pins: ContractorPins = CONTRACTOR_PRODUCTION_PINS) {
    this.key = key; this.send = send; this.pins = pins;
  }
  async call(body: unknown, scope: Scope, browser: string, session: string | null = null): Promise<unknown> {
    const bytes = Buffer.from(JSON.stringify(body));
    const target = this.pins.contractorOrigin + CONTRACTOR_SOURCE_PATH;
    const response = await this.send(target, { method: 'POST', body: bytes, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json',
        [ASSERTION_HEADER]: signContractorAssertion(this.key, 'ask', target, scope, bytes, browser, session, null, Date.now(), this.pins) } });
    if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new RuntimeError('unavailable');
    const result = JSON.parse((await boundedBody(response)).toString('utf8'));
    if (result?.ok !== true) throw new RuntimeError('unavailable');
    if (scope === 'source:ack' && result.result?.watchCreated !== false) throw new RuntimeError('unavailable');
    return result.result;
  }
  async publication(browser: string, profile: ProfileIdentity): Promise<ContractorPublication> {
    if (!isContractorIdentity(profile)) throw new RuntimeError('unavailable');
    const identity = { hub: profile.hub, nativeId: profile.nativeId, profileClass: profile.profileClass };
    const proof = await this.call({ action: 'resolve', profile: identity }, 'source:read', browser) as ContractorPublication;
    if (!proof || !isContractorIdentity(proof.identity) || proof.identity.nativeId !== profile.nativeId ||
      typeof proof.canonicalSlug !== 'string' || !SLUG.test(proof.canonicalSlug) ||
      proof.publicationState !== 'PUBLISHABLE' || proof.reviewedClass !== CONTRACTOR_PROFILE_CLASS ||
      !Number.isFinite(proof.checkedAt) || proof.checkedAt > Date.now() + 2000 || proof.checkedAt < Date.now() - 5000) throw new RuntimeError('unavailable');
    return proof;
  }
}

/** Production pins only. A preview target never gains a Contractor origin from this helper. */
export function contractorPinsFor(target: DeploymentTarget): ContractorPins | null {
  if (target.kind !== 'production') return null;
  if (target.parentOrigin !== CONTRACTOR_PRODUCTION_PINS.parentOrigin) return null;
  return CONTRACTOR_PRODUCTION_PINS;
}
