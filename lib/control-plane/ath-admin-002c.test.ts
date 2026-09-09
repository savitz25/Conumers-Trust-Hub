import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync('app/admin/page.tsx', 'utf8');
const diagnostic = readFileSync('app/api/internal/ath-admin-002c-runtime-db/route.ts', 'utf8');

test('Admin distinguishes non-staff, disabled, forbidden, and infrastructure failure states', () => {
  assert.match(page, /Admin access disabled/);
  assert.match(page, /role does not permit access/);
  assert.match(page, /no active staff authorization/);
  assert.match(page, /Control Plane temporarily unavailable/);
  assert.match(page, /admin_authorization_infrastructure_error/);
});

test('temporary runtime diagnostic requires canonical session and returns only bounded metadata', () => {
  assert.match(diagnostic, /platform\.sessionUser\(token\)/);
  assert.match(diagnostic, /UNAUTHENTICATED/);
  for (const forbidden of ['connectionString', 'ASK_DATABASE_URL', 'neon_tech_database', 'email', 'sessionToken', 'userId']) {
    assert.equal(diagnostic.includes(forbidden), false, `${forbidden} must not be serialized`);
  }
  for (const allowed of ['neonProjectId', 'neonBranchId', 'database', 'postgresVersion', 'users', 'sessions', 'adminStaff']) {
    assert.equal(diagnostic.includes(allowed), true, `${allowed} should be present`);
  }
});
