import { ASSERTION_HEADER, boundedBody } from './service-assertion.ts';
import { API_PATH, type DeploymentTarget } from './isolated-config.ts';
import { RuntimeError } from './runtime.ts';
import { INVESTOR_PRODUCTION_PINS, signInvestorAssertion, type InvestorPins } from './investor-assertion.ts';
import { INVESTOR_PROFILE_CLASS, investorCanonicalSlug, investorReturnPath, parseInvestorNativeId } from './investor-binding.ts';
import { isGuestStageInput, type GuestStageInput } from '../contracts/v2-3-profile-transfer.ts';
import type { ProfileIdentity } from '../contracts/v2-3-profile-save.ts';
import type { AssertionKey, Scope } from './service-assertion.ts';

export const INVESTOR_SOURCE_PATH = API_PATH + '/source';

export function isInvestorOfficialFirmIdentity(profile: ProfileIdentity): boolean {
  return profile.hub === 'investor' && profile.profileClass === INVESTOR_PROFILE_CLASS && parseInvestorNativeId(profile.nativeId) !== null;
}

/** One official firm, and the slug and return path are the ones that CRD
 * implies: sec-crd-<CRD> and /firm/sec-crd-<CRD>. Nothing else is a stage. */
export function isInvestorOfficialFirmStage(input: unknown): input is GuestStageInput {
  if (!isGuestStageInput(input) || input.sourceHub !== 'investor' || input.version !== 'v2-3/selected-profiles/3') return false;
  const task = input.returnTask;
  if (task.hub !== 'investor' || !isInvestorOfficialFirmIdentity(task.profile)) return false;
  const crd = parseInvestorNativeId(task.profile.nativeId)!;
  if (task.canonicalSlug !== investorCanonicalSlug(crd) || !('returnPath' in task) || task.returnPath !== investorReturnPath(crd)) return false;
  return input.selected.length === 1 && isInvestorOfficialFirmIdentity(input.selected[0]!.profile) &&
    input.selected[0]!.profile.nativeId === task.profile.nativeId && input.selected[0]!.localItemId === task.canonicalSlug;
}

export type InvestorPublication = {
  identity: ProfileIdentity;
  canonicalSlug: string;
  publicationState: 'PUBLISHABLE';
  reviewedClass: 'official_firm';
  checkedAt: number;
};

/** Ask calls Investor. The browser never carries the CRD or the signing key. */
export class InvestorSourceChannel {
  readonly key: AssertionKey;
  readonly send: typeof fetch;
  readonly pins: InvestorPins;
  constructor(key: AssertionKey, send: typeof fetch = fetch, pins: InvestorPins = INVESTOR_PRODUCTION_PINS) {
    this.key = key; this.send = send; this.pins = pins;
  }
  async call(body: unknown, scope: Scope, browser: string, session: string | null = null): Promise<unknown> {
    const bytes = Buffer.from(JSON.stringify(body));
    const target = this.pins.investorOrigin + INVESTOR_SOURCE_PATH;
    const response = await this.send(target, { method: 'POST', body: bytes, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json',
        [ASSERTION_HEADER]: signInvestorAssertion(this.key, 'ask', target, scope, bytes, browser, session, null, Date.now(), this.pins) } });
    if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new RuntimeError('unavailable');
    const result = JSON.parse((await boundedBody(response)).toString('utf8'));
    if (result?.ok !== true) throw new RuntimeError('unavailable');
    return result.result;
  }
  /** Investor re-proves, from its own publication source, that exactly one
   * official firm is published for this CRD at its canonical slug. */
  async publication(browser: string, profile: ProfileIdentity): Promise<InvestorPublication> {
    if (!isInvestorOfficialFirmIdentity(profile)) throw new RuntimeError('unavailable');
    const crd = parseInvestorNativeId(profile.nativeId)!;
    const identity = { hub: profile.hub, nativeId: profile.nativeId, profileClass: profile.profileClass };
    const proof = await this.call({ action: 'resolve', profile: identity }, 'source:read', browser) as InvestorPublication;
    if (!proof || !isInvestorOfficialFirmIdentity(proof.identity) || proof.identity.nativeId !== profile.nativeId ||
      proof.canonicalSlug !== investorCanonicalSlug(crd) ||
      proof.publicationState !== 'PUBLISHABLE' || proof.reviewedClass !== 'official_firm' ||
      !Number.isFinite(proof.checkedAt) || proof.checkedAt > Date.now() + 2000 || proof.checkedAt < Date.now() - 5000) throw new RuntimeError('unavailable');
    return proof;
  }
}

/** Production pins only. A preview target never gains an Investor origin from this helper. */
export function investorPinsFor(target: DeploymentTarget): InvestorPins | null {
  if (target.kind !== 'production') return null;
  if (target.parentOrigin !== INVESTOR_PRODUCTION_PINS.parentOrigin) return null;
  return INVESTOR_PRODUCTION_PINS;
}
