import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  APPROVED_EMAIL_GRANT,
  DOCUMENT_UPLOAD_DECISION,
  FORBIDDEN_PUBLIC_PHRASES,
  LOGIN_EMAIL_CAVEAT,
  PUBLIC_LANGUAGE,
  containsForbiddenPublicLanguage,
} from './copy.ts';
import { assertReadOnlyCthSql } from './layer-a.ts';

test('login copy states confirmation is not ownership', () => {
  assert.match(LOGIN_EMAIL_CAVEAT, /does not verify that you own or manage a business/i);
  assert.equal(containsForbiddenPublicLanguage(LOGIN_EMAIL_CAVEAT), false);
});

test('approved copy is not an endorsement', () => {
  assert.match(APPROVED_EMAIL_GRANT, /authorized to manage business-supplied information/i);
  for (const p of FORBIDDEN_PUBLIC_PHRASES) {
    assert.equal(APPROVED_EMAIL_GRANT.toLowerCase().includes(p.toLowerCase()), false);
  }
});

test('allowed managed-profile language', () => {
  assert.equal(PUBLIC_LANGUAGE.managedProfile, 'Managed profile');
});

test('document upload is deferred', () => {
  assert.match(DOCUMENT_UPLOAD_DECISION, /deferred/i);
});

test('evidence firewall rejects Layer A writes', () => {
  assert.throws(() => assertReadOnlyCthSql('UPDATE licenses SET status_normalized = $1'));
  assert.throws(() => assertReadOnlyCthSql('DELETE FROM regulatory_source_observations'));
  assert.doesNotThrow(() => assertReadOnlyCthSql('SELECT id FROM contractors WHERE id = $1'));
});
