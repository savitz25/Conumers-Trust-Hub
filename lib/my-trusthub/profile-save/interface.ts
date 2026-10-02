/** Immutable wire handoff: implementation must authenticate outside this envelope. */
import type { ProfileTransferPort } from '../contracts/v2-3-profile-transfer.ts';

export const PROFILE_SAVE_ENDPOINT = '/api/my-trusthub/profile-save' as const;
export const PROFILE_SAVE_RUNTIME_VERSION = 'v2-3/parent-runtime/1' as const;
export const OPERATIONS = [
  'prepareGuestProfileTransfer', 'prepareProfileSaveContinuation',
  'consumeProfileSaveContinuation', 'commitProfileSave',
  'getProfileSaveReceipt', 'verifyProfileSaveReceipt',
] as const;
export type Operation = typeof OPERATIONS[number];
export type RequestFor<K extends Operation> = {
  version: typeof PROFILE_SAVE_RUNTIME_VERSION;
  operation: K;
  input: Parameters<ProfileTransferPort[K]>[0];
};
export type RuntimeRequest = { [K in Operation]: RequestFor<K> }[Operation];
export type ResponseFor<K extends Operation> =
  | { ok: true; operation: K; result: Awaited<ReturnType<ProfileTransferPort[K]>> }
  | { ok: false; error: 'disabled' | 'unavailable' | 'invalid' | 'unauthorized' | 'expired' | 'conflict' | 'rate_limited' };
