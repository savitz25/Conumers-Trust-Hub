/** LOCAL HARNESS ONLY: durable SQLite store, MOCKED identity registry/P12/P13.
 * Never import into a Next route. No env credentials, network or production DB.
 */
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import type { RuntimeBackend, RuntimeTransaction } from '../../lib/my-trusthub/profile-save/runtime.ts';
import { RuntimeError } from '../../lib/my-trusthub/profile-save/runtime.ts';
import type { TrustedProfile } from '../../lib/my-trusthub/contracts/v2-3-profile-save.ts';
import { profileKey } from '../../lib/my-trusthub/contracts/v2-3-profile-transfer.ts';

export class SqliteHarnessBackend implements RuntimeBackend {
  readonly db: DatabaseSync;
  profiles = new Map<string, TrustedProfile>();
  failReceipt = false;
  projectFails = false;
  exchangeSubject: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS objects(kind TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(kind,key));
      CREATE TABLE IF NOT EXISTS quota(key TEXT PRIMARY KEY, minute INTEGER, count INTEGER);
      CREATE TABLE IF NOT EXISTS saves(subject TEXT, entity TEXT, ref TEXT, PRIMARY KEY(subject,entity));
      CREATE TABLE IF NOT EXISTS memberships(subject TEXT, project TEXT, saved TEXT, PRIMARY KEY(subject,project,saved));
      CREATE TABLE IF NOT EXISTS consumed(exchange TEXT PRIMARY KEY);`);
  }
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work, work);
    this.queue = result.catch(() => {}); return result;
  }
  rateLimit(key: string, now: number, maximum: number) {
    return this.serial(async () => {
      const minute = Math.floor(now / 60_000);
      const r = this.db.prepare('SELECT minute,count FROM quota WHERE key=?').get(key) as { minute: number; count: number } | undefined;
      const count = r?.minute === minute ? r.count + 1 : 1;
      this.db.prepare('INSERT INTO quota VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET minute=excluded.minute,count=excluded.count').run(key, minute, count);
      return count <= maximum;
    });
  }
  transaction<T>(work: (tx: RuntimeTransaction) => Promise<T>): Promise<T> {
    return this.serial(async () => {
      this.db.exec('BEGIN IMMEDIATE');
      const tx: RuntimeTransaction = {
        read: async <V>(kind: string, key: string) => {
          const row = this.db.prepare('SELECT value FROM objects WHERE kind=? AND key=?').get(kind, key) as { value: string } | undefined;
          return row ? JSON.parse(row.value) as V : null;
        },
        put: async (kind, key, value) => {
          if (kind === 'receipt' && this.failReceipt) throw new Error('Fixture receipt write failure');
          this.db.prepare('INSERT INTO objects VALUES(?,?,?) ON CONFLICT(kind,key) DO UPDATE SET value=excluded.value').run(kind, key, JSON.stringify(value));
        },
        resolveProfile: async p => this.profiles.get(profileKey(p)) ?? null,
        resolveReturnTask: async p => this.profiles.has(profileKey(p)) ? { kind: 'profile', hub: 'move', canonicalSlug: p.nativeId, profile: p } : null,
        consumeP13: async (exchange, caller) => {
          if (this.db.prepare('SELECT 1 FROM consumed WHERE exchange=?').get(exchange)) throw new RuntimeError('conflict');
          this.db.prepare('INSERT INTO consumed VALUES(?)').run(exchange);
          return { subject: this.exchangeSubject ?? caller.parent!.subject };
        },
        saveP12: async (binding, caller) => {
          const profile = [...this.profiles.values()].find(p => p.binding?.id === binding);
          if (!profile?.binding || !caller.parent) throw new RuntimeError('unauthorized');
          const subject = caller.parent.subject, entity = profile.binding.networkEntityId;
          const existing = this.db.prepare('SELECT ref FROM saves WHERE subject=? AND entity=?').get(subject, entity) as { ref: string } | undefined;
          if (existing) return { savedRef: existing.ref, created: false, restored: false };
          const savedRef = randomBytes(32).toString('base64url');
          this.db.prepare('INSERT INTO saves VALUES(?,?,?)').run(subject, entity, savedRef);
          return { savedRef, created: true, restored: false };
        },
        addProjectP12: async (project, saved, caller) => {
          if (this.projectFails || project !== 'p'.repeat(43) || caller.parent?.subject !== 'fixture-consumer-a') return 'failed';
          const changed = this.db.prepare('INSERT OR IGNORE INTO memberships VALUES(?,?,?)').run(caller.parent.subject, project, saved).changes;
          return changed ? 'added' : 'already_member';
        },
      };
      try { const result = await work(tx); this.db.exec('COMMIT'); return structuredClone(result); }
      catch (error) { this.db.exec('ROLLBACK'); throw error; }
    });
  }
  count(table: 'saves' | 'memberships' | 'consumed') { return (this.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n; }
  close() { this.db.close(); }
}
