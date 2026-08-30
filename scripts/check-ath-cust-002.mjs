import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const files = [
  'schema/migrations/001_ath_customer_platform.sql',
  'schema/migrations/001_ath_customer_platform.down.sql',
  'lib/customer/store.ts',
  'lib/customer/handoff.ts',
  'app/claim/continue/page.tsx',
  'app/internal/review/page.tsx',
  'app/manage/page.tsx',
];
for (const f of files) {
  if (!existsSync(f)) {
    console.error('missing', f);
    process.exit(1);
  }
}

const tests = [
  'lib/customer/handoff.test.ts',
  'lib/customer/adapter.test.ts',
  'lib/customer/copy.test.ts',
  'lib/customer/platform.test.ts',
];
const r = spawnSync(
  process.execPath,
  ['--experimental-strip-types', '--test', ...tests],
  { stdio: 'inherit' }
);
process.exit(r.status ?? 1);
