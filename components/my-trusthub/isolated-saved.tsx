import { headers } from 'next/headers';
import Link from 'next/link';
import { hostedRuntime } from '@/lib/my-trusthub/profile-save/hosted-runtime';
import { ASK_PREVIEW } from '@/lib/my-trusthub/profile-save/isolated-config';

/** Save-only preview surface. Does not load absent Sessions/Watch/Alert schemas
 * or expose the internal canary binding form. Production keeps its own page. */
export async function IsolatedSaved() {
  const request = new Request(ASK_PREVIEW + '/my/saved', { headers: await headers() });
  const runtime = await hostedRuntime();
  if (!runtime) return <main className="mx-auto max-w-2xl p-6"><h1>Saved profiles are unavailable</h1><p>Your device copy is retained. Please try again later.</p></main>;
  const parent = await runtime.parent(request);
  if (!parent) return <main className="mx-auto max-w-2xl p-6"><h1>Your saved profiles</h1><Link href="/my/sign-in?next=%2Fmy%2Fsaved">Sign in to continue</Link></main>;
  const saved = await runtime.store.authorized(async db => (await db.query<{ saved_entity_id: string; canonical_name: string; primary_hub: string; saved_at: string }>(
    'select * from v23_private.preview_saved($1,$2)', [parent.subject, parent.session])).rows);
  const current = await runtime.parent(request);
  if (current?.subject !== parent.subject || current.session !== parent.session) return <main className="mx-auto max-w-2xl p-6"><h1>Your account changed</h1><p>Refresh to continue with your current account.</p></main>;
  return <main className="mx-auto max-w-2xl space-y-4 break-words p-6">
    <h1 className="text-2xl font-semibold">Your saved profiles</h1>
    <p data-ph-mask="true">{parent.label}</p>
    <p>Profiles saved to My TrustHub stay here when you return. Save does not start a Watch.</p>
    {saved.length ? <ul className="space-y-3">{saved.map(item => <li key={item.saved_entity_id} className="rounded border p-4">
      <h2 className="font-semibold">{item.canonical_name}</h2><p>Saved from {item.primary_hub}</p>
    </li>)}</ul> : <p>No profiles saved to this account yet.</p>}
    <Link className="underline focus-visible:outline focus-visible:outline-2" href="/my/sign-in">Account sign-in</Link>
  </main>;
}
