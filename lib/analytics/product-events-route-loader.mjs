import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const stubs = new URL('./product-events-route-stubs.mjs', import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') {
    return { url: new URL('?kind=next', stubs).href, shortCircuit: true };
  }
  if (specifier === '@/lib/control-plane/product-events') {
    return { url: new URL('?kind=events', stubs).href, shortCircuit: true };
  }
  if (specifier === '@/lib/customer/server') {
    return { url: new URL('?kind=server', stubs).href, shortCircuit: true };
  }
  if (specifier.startsWith('@/')) {
    let file = join(root, specifier.slice(2));
    if (!existsSync(file)) {
      if (existsSync(`${file}.ts`)) file = `${file}.ts`;
      else if (existsSync(`${file}.tsx`)) file = `${file}.tsx`;
    }
    return nextResolve(pathToFileURL(file).href, context);
  }
  return nextResolve(specifier, context);
}
