import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync('app/admin/page.tsx', 'utf8');
const proof = readFileSync('app/api/internal/ath-admin-002c-post-bootstrap-proof/route.ts', 'utf8');

test('Admin distinguishes non-staff, disabled, forbidden, and infrastructure failure states', () => {
  assert.match(page, /Admin access disabled/);
  assert.match(page, /role does not permit access/);
  assert.match(page, /no active staff authorization/);
  assert.match(page, /Control Plane temporarily unavailable/);
  assert.match(page, /admin_authorization_infrastructure_error/);
});

test('temporary post-bootstrap proof is Super Admin-only, bounded, and leaves controls disconnected', () => {
  assert.match(proof, /require\(token, 'ADMIN_COMMAND_EXECUTE'\)/);
  assert.match(proof, /actor\.role !== 'SUPER_ADMIN'/);
  assert.match(proof, /ath-admin-002c-production-proof-v1/);
  assert.match(proof, /NOT_YET_CONNECTED/);
  assert.match(proof, /SAVEPOINT ath_002c_update/);
  assert.match(proof, /SAVEPOINT ath_002c_delete/);
  for (const forbidden of ['email', 'sessionId', 'sessionToken', 'cookie', 'ATH_OPERATOR_SECRET']) {
    assert.equal(proof.includes(forbidden), false, `${forbidden} must not be returned or accepted`);
  }
});
