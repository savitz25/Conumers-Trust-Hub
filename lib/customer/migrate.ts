import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SqlClient } from './sql.ts';

export function splitSqlStatements(sql: string): string[] {
  const parts: string[] = [];
  let buf = '';
  let inDollar = false;
  let inLineComment = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (inLineComment) {
      buf += ch;
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (!inDollar && ch === '-' && next === '-') {
      inLineComment = true;
      buf += '--';
      i += 1;
      continue;
    }
    if (ch === '$' && next === '$') {
      inDollar = !inDollar;
      buf += '$$';
      i += 1;
      continue;
    }
    if (!inDollar && ch === ';') {
      const stmt = stripLeadingSqlComments(buf);
      if (stmt) parts.push(stmt);
      buf = '';
      continue;
    }
    buf += ch;
  }
  const last = stripLeadingSqlComments(buf);
  if (last) parts.push(last);
  return parts;
}

function stripLeadingSqlComments(raw: string): string {
  return raw
    .split(/\n/)
    .filter((line) => !/^\s*--/.test(line))
    .join('\n')
    .trim();
}

export async function applyCustomerMigrations(client: SqlClient): Promise<void> {
  const migrationDir = join(process.cwd(), 'schema/migrations');
  const paths = readdirSync(migrationDir)
    .filter((name) => /^\d+_.*\.sql$/.test(name) && !name.endsWith('.down.sql'))
    .sort()
    .map((name) => join(migrationDir, name));
  for (const sqlPath of paths) {
    const sql = readFileSync(sqlPath, 'utf8');
    if (client.exec) {
      try {
        await client.exec(sql);
      } catch {
        await client.exec(sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/g, ''));
      }
      continue;
    }
    for (const stmt of splitSqlStatements(sql)) {
      try {
        await client.query(stmt);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/pgcrypto|extension/i.test(stmt) && /does not exist|unavailable|not available/i.test(message)) continue;
        throw err;
      }
    }
  }
}

export async function enableAppRole(client: SqlClient): Promise<void> {
  await client.query("SELECT set_config('ath.app_role', 'server', true)");
}
