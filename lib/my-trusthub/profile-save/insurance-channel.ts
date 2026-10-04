import { ASSERTION_HEADER, boundedBody, type AssertionKey } from './service-assertion.ts';
import { API_PATH } from './isolated-config.ts';
import { RuntimeError } from './runtime.ts';
import { INSURANCE_PRODUCTION_PINS, signInsuranceAssertion, type InsurancePins } from './insurance-assertion.ts';
import { INSURANCE_PROFILE_CLASS, parseInsuranceSpecialistEntityId } from './insurance-binding.ts';
import type { ItemReceipt } from '../contracts/v2-3-profile-transfer.ts';

export const INSURANCE_SOURCE_PATH = API_PATH + '/source';

/** Ask tells Insurance the account outcome of one profile. Insurance reports an
 * account Save or Unsave only on this signed call; it accepts nothing else on
 * this path (no resolve, no source: the signed closed manifest is the source).
 * One receipt per call, for one state-license identity, never a Watch. */
export class InsuranceAckChannel {
  readonly key: AssertionKey;
  readonly send: typeof fetch;
  readonly pins: InsurancePins;
  constructor(key: AssertionKey, send: typeof fetch = fetch, pins: InsurancePins = INSURANCE_PRODUCTION_PINS) {
    this.key = key; this.send = send; this.pins = pins;
  }
  async acknowledge(continuationRef: string, receipts: ItemReceipt[], browser: string, session: string): Promise<void> {
    const receipt = receipts[0];
    if (receipts.length !== 1 || !receipt || receipt.localCopy !== 'keep' || !['saved', 'already_saved', 'local_only'].includes(receipt.parent.outcome) ||
      receipt.item.profile.hub !== 'insurance' || receipt.item.profile.profileClass !== INSURANCE_PROFILE_CLASS ||
      !parseInsuranceSpecialistEntityId(receipt.item.profile.nativeId) || !receipt.requestKey.startsWith(browser + ':')) throw new RuntimeError('unavailable');
    const bytes = Buffer.from(JSON.stringify({ action: 'acknowledge', continuationRef, receipts }));
    const target = this.pins.insuranceOrigin + INSURANCE_SOURCE_PATH;
    const response = await this.send(target, { method: 'POST', body: bytes, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json',
        [ASSERTION_HEADER]: signInsuranceAssertion(this.key, 'ask', target, 'source:ack', bytes, browser, session, null, Date.now(), this.pins) } });
    if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new RuntimeError('unavailable');
    const result = JSON.parse((await boundedBody(response)).toString('utf8'));
    if (result?.ok !== true || result.result?.watchCreated !== false) throw new RuntimeError('unavailable');
  }
}
