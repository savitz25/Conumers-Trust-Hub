'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ProductionMyTrustHubAdapter } from '@/lib/my-trusthub/production-adapter';
import { hostedRuntime } from '@/lib/my-trusthub/profile-save/hosted-runtime';
import { ASK_PREVIEW, uuid } from '@/lib/my-trusthub/profile-save/isolated-config';

/**
 * Unsave from the isolated preview Saved surface. The verified parent session
 * must own the row (preview_saved lists only this account's active Saves);
 * removal itself goes through the P12 owner-scoped RPC with the user's own
 * session, never the service pool. Watches are untouched because Save never
 * started one.
 */
export async function unsaveIsolatedProfileAction(formData: FormData) {
  const savedEntityId = String(formData.get('savedEntityId') ?? '');
  if (!uuid(savedEntityId)) redirect('/my/saved?error=unsave');
  const runtime = await hostedRuntime();
  if (!runtime) redirect('/my/saved?error=unavailable');
  const request = new Request(ASK_PREVIEW + '/my/saved', { headers: await headers() });
  const parent = await runtime.parent(request);
  if (!parent) redirect('/my/sign-in?next=%2Fmy%2Fsaved');
  const owned = await runtime.store.authorized(async (db) =>
    (await db.query<{ saved_entity_id: string }>('select saved_entity_id from v23_private.preview_saved($1,$2)', [parent.subject, parent.session]))
      .rows.some((row) => row.saved_entity_id === savedEntityId));
  if (!owned) redirect('/my/saved?error=unsave');
  let outcome: 'removed' | 'failed' = 'failed';
  try {
    const adapter = await ProductionMyTrustHubAdapter.create();
    if (adapter) {
      await adapter.removeSavedEntity(savedEntityId);
      outcome = 'removed';
    }
  } catch (error) {
    console.warn(JSON.stringify({ event: 'my_trusthub_v23_unsave_failed', code: error instanceof Error ? error.message.slice(0, 120) : 'unknown' }));
  }
  revalidatePath('/my/saved');
  revalidatePath('/my');
  redirect(outcome === 'removed' ? '/my/saved?unsaved=1' : '/my/saved?error=unsave');
}
