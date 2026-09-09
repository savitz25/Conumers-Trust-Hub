import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync('app/admin/page.tsx', 'utf8');

test('Admin distinguishes non-staff, disabled, forbidden, and infrastructure failure states', () => {
  assert.match(page, /Admin access disabled/);
  assert.match(page, /role does not permit access/);
  assert.match(page, /no active staff authorization/);
  assert.match(page, /Control Plane temporarily unavailable/);
  assert.match(page, /admin_authorization_infrastructure_error/);
});
