import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateNetwork } from '../lib/network-intelligence/contract.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { fingerprints } = validateNetwork();
writeFileSync(join(root, 'data/network-intelligence/fingerprints-v1.json'), `${JSON.stringify(fingerprints, null, 2)}\n`);
console.log(JSON.stringify(fingerprints, null, 2));
