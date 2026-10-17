/**
 * LOCAL / ISOLATED SQLITE / MOCKED binding.
 *
 * Proves the Ask confirmation handler for the proposed Lender target
 * freedom-mortgage / nmls:2767 with two synthetic harness subjects.
 * The binding is injected by this fixture. It is not an accepted
 * Packet 12 row, not a hosted Ask Postgres row, and not the live
 * Lender parent-sync gate. Device localStorage is the in-memory
 * confirmation map; the fresh read uses a new SQLite connection
 * after that map is cleared. The local Unsave stand-in removes one
 * selected network entity for the verified subject. That is not
 * production deletion semantics or Postgres RLS.
 */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { handleProfileConfirmation } from './browser.ts';
import { fixture } from './browser.fixture.ts';
import { RuntimeError } from './runtime.ts';
import { SqliteHarnessBackend } from '../../../scripts/qa/v23-sqlite-backend.ts';

const RETURN = 'https://www.lendertrusthub.com/lenders/freedom-mortgage';
const USER_A = 'synthetic-user-a';
const SESSION_A = 'session-a';
const USER_B = 'synthetic-user-b';
const SESSION_B = 'session-b';
const BINDING = {
  id: 'mocked-accepted-binding-nmls-2767',
  networkEntityId: 'mocked-entity-nmls-2767',
  status: 'accepted' as const,
};
const journey = {
  environment: 'production' as const,
  hub: 'lender' as const,
  slug: 'freedom-mortgage',
  nativeId: 'nmls:2767',
  binding: BINDING,
};

type SavedRow = { subject: string; entity: string; ref: string };

function savedRow(value: Record<string, unknown>): SavedRow {
  const subject = value.subject;
  const entity = value.entity;
  const ref = value.ref;
  if (typeof subject !== 'string' || typeof entity !== 'string' || typeof ref !== 'string') {
    assert.fail('save row is missing subject, entity, or ref');
  }
  return { subject, entity, ref };
}

function savedBy(db: DatabaseSync, subject: string): SavedRow[] {
  return db.prepare('SELECT subject, entity, ref FROM saves WHERE subject=? ORDER BY ref').all(subject).map(savedRow);
}

test('sign-in preserves a Lender Save for freedom-mortgage / nmls:2767', async () => {
  const signedOut = await fixture({ ...journey, intent: 'save' });
  try {
    const returned = await signedOut.get();
    assert.equal(returned.status, 303);
    assert.equal(returned.headers.get('location'), RETURN);
    assert.equal(savedBy(signedOut.backend.db, USER_A).length, 0);
    signedOut.login(USER_A, SESSION_A);
    const completed = await signedOut.get();
    assert.equal(completed.status, 303);
    assert.equal(completed.headers.get('location'), RETURN);
    const rows = savedBy(signedOut.backend.db, USER_A);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.entity, BINDING.networkEntityId);
  } finally { signedOut.close(); }

  const gate = await fixture({ ...journey, intent: 'save_signin' });
  try {
    const page = await gate.get();
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /Sign in to continue/);
    assert.doesNotMatch(html, /Saved to My TrustHub/);
    assert.equal(gate.backend.count('saves'), 0);
    gate.login(USER_A, SESSION_A);
    assert.equal((await gate.get()).headers.get('location'), RETURN);
    assert.equal(savedBy(gate.backend.db, USER_A).length, 1);
  } finally { gate.close(); }
});

test('two synthetic subjects persist, isolate, and remove one mocked nmls:2767 Save', async () => {
  const databasePath = join(mkdtempSync(join(tmpdir(), 'b4-freedom-2767-')), 'qa.sqlite');
  const first = await fixture({ ...journey, intent: 'save', databasePath });
  try {
    first.login(USER_A, SESSION_A);
    const saved = await first.get();
    assert.equal(saved.status, 303);
    assert.equal(saved.headers.get('location'), RETURN);
    const confirmation = [...first.records.values()].find((row) => row.receipts?.length);
    assert.ok(confirmation?.accountContextRef);
    if (!confirmation) assert.fail('missing confirmation');
    assert.equal(confirmation.source.manifest.selected[0]!.profile.nativeId, 'nmls:2767');
    assert.equal(confirmation.source.manifest.selected[0]!.profile.profileClass, 'marketplace_company');
    assert.notEqual(confirmation.source.manifest.selected[0]!.profile.nativeId, 'nmls:1984721');
    assert.equal(confirmation.source.manifest.returnTask.canonicalSlug, 'freedom-mortgage');
    const returnTask = confirmation.source.manifest.returnTask;
    if (!('returnPath' in returnTask)) assert.fail('expected a version 3 return task');
    assert.equal(returnTask.returnPath, '/lenders/freedom-mortgage');
    assert.equal(confirmation.receipts![0]!.parent.outcome, 'saved');
    const original = savedBy(first.backend.db, USER_A);
    assert.equal(original.length, 1);
    assert.equal(original[0]!.entity, BINDING.networkEntityId);
    assert.equal(savedBy(first.backend.db, USER_B).length, 0);

    const retry = await first.get();
    assert.equal(retry.status, 303);
    assert.equal(retry.headers.get('location'), RETURN);
    assert.equal(savedBy(first.backend.db, USER_A)[0]!.ref, original[0]!.ref);
    assert.equal(first.backend.count('saves'), 1);

    const reader = await first.b.runtime(new Request(first.origin + '/my/profile-save'), confirmation, {
      subject: USER_A, session: SESSION_A, label: 'Synthetic A',
    });
    const own = await reader.execute('getProfileSaveReceipt', {
      requestKey: confirmation.receipts![0]!.requestKey,
      accountContextRef: confirmation.accountContextRef,
    }) as { parent: { outcome: string } } | null;
    assert.equal(own?.parent.outcome, 'saved');

    const intruder = await first.b.runtime(new Request(first.origin + '/my/profile-save'), confirmation, {
      subject: USER_B, session: SESSION_B, label: 'Synthetic B',
    });
    await assert.rejects(
      () => intruder.execute('getProfileSaveReceipt', {
        requestKey: confirmation.receipts![0]!.requestKey,
        accountContextRef: confirmation.accountContextRef,
      }),
      (error: unknown) => error instanceof RuntimeError && error.code === 'unauthorized',
    );
    assert.equal(savedBy(first.backend.db, USER_A)[0]!.ref, original[0]!.ref);

    first.logout();
    first.login(USER_B, SESSION_B);
    const crossed = await first.get();
    assert.equal(crossed.status, 409);
    assert.match(await crossed.text(), /different account/);
    assert.equal(savedBy(first.backend.db, USER_A)[0]!.ref, original[0]!.ref);
    const bUnsave = await first.again('unsave');
    assert.equal((await bUnsave.get()).status, 303);
    assert.equal(savedBy(first.backend.db, USER_B).length, 0);
    assert.equal(savedBy(first.backend.db, USER_A)[0]!.ref, original[0]!.ref);

    first.login(USER_A, SESSION_A);
    const duplicate = await first.again('save');
    assert.equal((await duplicate.get()).headers.get('location'), RETURN);
    assert.equal(savedBy(first.backend.db, USER_A).length, 1);
    assert.equal(savedBy(first.backend.db, USER_A)[0]!.ref, original[0]!.ref);
    assert.ok([...first.records.values()].some((row) => row.receipts?.some((receipt) => receipt.parent.outcome === 'already_saved')));

    const acksBeforeReplay = first.acks;
    const savesBeforeReplay = first.backend.count('saves');
    const replay = await handleProfileConfirmation(
      first.post(first.arrivalBody(first.continuation.continuationRef, 'save'), '', first.sourceOrigin),
      first.b,
    );
    assert.equal(replay.status, 303);
    const replayCookie = replay.headers.get('set-cookie')!.split(';')[0]!;
    const replayRead = await handleProfileConfirmation(
      new Request(first.origin + '/my/profile-save', { headers: { cookie: replayCookie } }),
      first.b,
    );
    assert.equal(replayRead.status, 303);
    assert.equal(replayRead.headers.get('location'), RETURN);
    assert.equal(first.acks, acksBeforeReplay);
    assert.equal(first.backend.count('saves'), savesBeforeReplay);
    assert.equal(savedBy(first.backend.db, USER_A)[0]!.ref, original[0]!.ref);
    const replayKey = replayCookie.slice(replayCookie.indexOf('=') + 1);
    assert.equal(first.records.get(replayKey)?.receipts, undefined);

    const watched = await handleProfileConfirmation(
      first.post(first.arrivalBody(first.continuation.continuationRef, 'watch'), '', first.sourceOrigin),
      first.b,
    );
    assert.equal(watched.status, 503);
    const tables = first.backend.db.prepare("SELECT group_concat(name) AS names FROM (SELECT name FROM sqlite_master WHERE type='table' ORDER BY name)").get() as { names: string };
    assert.equal(tables.names, 'consumed,memberships,objects,quota,saves');
    assert.doesNotMatch(tables.names, /watch|notification/i);

    const persistedRef = original[0]!.ref;
    first.records.clear();
    assert.equal(first.records.size, 0);
    first.close();

    const fresh = new SqliteHarnessBackend(databasePath);
    try {
      assert.equal(fresh.profiles.size, 0);
      const reopened = savedBy(fresh.db, USER_A);
      assert.equal(reopened.length, 1);
      assert.equal(reopened[0]!.ref, persistedRef);
      assert.equal(reopened[0]!.entity, BINDING.networkEntityId);
      assert.equal(savedBy(fresh.db, USER_B).length, 0);
    } finally { fresh.close(); }

    const removal = await fixture({ ...journey, intent: 'unsave', databasePath });
    try {
      assert.equal(removal.records.size, 1);
      removal.login(USER_A, SESSION_A);
      const removed = await removal.get();
      assert.equal(removed.status, 303);
      assert.equal(removed.headers.get('location'), RETURN);
      assert.equal(savedBy(removal.backend.db, USER_A).length, 0);
      assert.equal(savedBy(removal.backend.db, USER_B).length, 0);
    } finally { removal.close(); }

    const after = new SqliteHarnessBackend(databasePath);
    try {
      assert.equal(savedBy(after.db, USER_A).length, 0);
      assert.equal(savedBy(after.db, USER_B).length, 0);
    } finally { after.close(); }
  } finally {
    try { first.close(); } catch { /* already closed for the fresh-session read */ }
  }
});

test('Unsave removes only the selected item for the verified subject', async () => {
  const databasePath = join(mkdtempSync(join(tmpdir(), 'b4-freedom-2767-unsave-')), 'qa.sqlite');
  const unrelated = { subject: USER_A, entity: 'unrelated-entity-a', ref: 'unrelated-ref-a' };
  const otherAccount = { subject: USER_B, entity: 'b-item-entity', ref: 'b-item-ref' };
  const first = await fixture({ ...journey, intent: 'save', databasePath });
  const kept = () => {
    const target = savedBy(first.backend.db, USER_A).filter((row) => row.entity === BINDING.networkEntityId);
    const aside = savedBy(first.backend.db, USER_A).filter((row) => row.entity === unrelated.entity);
    const theirs = savedBy(first.backend.db, USER_B);
    return { target, aside, theirs };
  };
  try {
    first.login(USER_A, SESSION_A);
    assert.equal((await first.get()).headers.get('location'), RETURN);
    first.backend.db.prepare('INSERT INTO saves(subject,entity,ref) VALUES(?,?,?)').run(unrelated.subject, unrelated.entity, unrelated.ref);
    first.backend.db.prepare('INSERT INTO saves(subject,entity,ref) VALUES(?,?,?)').run(otherAccount.subject, otherAccount.entity, otherAccount.ref);
    const before = kept();
    assert.equal(before.target.length, 1);
    assert.equal(before.aside[0]!.ref, unrelated.ref);
    assert.equal(before.theirs[0]!.ref, otherAccount.ref);
    const targetRef = before.target[0]!.ref;

    first.login(USER_B, SESSION_B);
    assert.equal((await (await first.again('unsave')).get()).status, 303);
    const afterIntruder = kept();
    assert.equal(afterIntruder.target[0]!.ref, targetRef);
    assert.equal(afterIntruder.aside[0]!.ref, unrelated.ref);
    assert.equal(afterIntruder.theirs[0]!.ref, otherAccount.ref);

    first.login(USER_A, SESSION_A);
    assert.equal((await (await first.again('unsave')).get()).headers.get('location'), RETURN);
    const afterOwner = kept();
    assert.equal(afterOwner.target.length, 0);
    assert.equal(afterOwner.aside.length, 1);
    assert.equal(afterOwner.aside[0]!.ref, unrelated.ref);
    assert.equal(afterOwner.theirs.length, 1);
    assert.equal(afterOwner.theirs[0]!.ref, otherAccount.ref);
    first.close();

    const fresh = new SqliteHarnessBackend(databasePath);
    try {
      const target = savedBy(fresh.db, USER_A).filter((row) => row.entity === BINDING.networkEntityId);
      const aside = savedBy(fresh.db, USER_A).filter((row) => row.entity === unrelated.entity);
      const theirs = savedBy(fresh.db, USER_B);
      assert.equal(target.length, 0);
      assert.equal(aside.length, 1);
      assert.equal(aside[0]!.ref, unrelated.ref);
      assert.equal(theirs.length, 1);
      assert.equal(theirs[0]!.entity, otherAccount.entity);
      assert.equal(theirs[0]!.ref, otherAccount.ref);
    } finally { fresh.close(); }
  } finally {
    try { first.close(); } catch { /* closed before the fresh read */ }
  }
});
