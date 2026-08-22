/**
 * ASK-SEARCH-003 assert entry (delegates to tsx runner).
 */
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const r = spawnSync('npx', ['--yes', 'tsx', 'scripts/_run-search-003-tests.mts'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
process.exit(r.status ?? 1);
