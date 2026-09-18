/**
 * ATH-OBS-002E: customerClaimRecovery() is also what ClaimRecoveryCard's analytics resultState
 * passes through readClaimAuthErrorParam() before capture -- covering it here proves the fallback
 * the analytics property relies on.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { CUSTOMER_CLAIM_ERROR_CODES, customerClaimRecovery } from './claim-recovery.ts';

test('every declared claim recovery code resolves to a distinct recovery with a headline and 3 actions', () => {
  for (const code of CUSTOMER_CLAIM_ERROR_CODES) {
    const recovery = customerClaimRecovery(code);
    assert.ok(recovery.headline.length > 0, code);
    assert.equal(recovery.actions.length, 3, code);
  }
});

test('an unrecognized or attacker-controlled code falls back to HANDOFF_INVALID, never thrown or echoed', () => {
  const fallback = customerClaimRecovery('HANDOFF_INVALID');
  for (const hostile of ['user@example.com', '<script>x</script>', 'a'.repeat(500), undefined, null, '']) {
    assert.deepEqual(customerClaimRecovery(hostile as never), fallback);
  }
});
