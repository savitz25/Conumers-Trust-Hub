'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createMyTrustHubSupabaseClient } from '@/lib/supabase/server';
import { accountRuntime, safeReturn } from '@/lib/my-trusthub/account-policy';
import { runAccountOperation, type AccountOperation, type AccountResult } from '@/lib/my-trusthub/account-service';

export async function accountAction(operation: AccountOperation, _previous: AccountResult, form: FormData): Promise<AccountResult> {
  if (!['signup', 'login', 'link', 'recovery', 'password'].includes(operation)) return { error: 'This request is unavailable.' };
  const runtime = accountRuntime(process.env);
  const origin = (await headers()).get('origin');
  if (!runtime || origin !== runtime.origin) return { error: 'Account access is unavailable in this environment.' };
  const client = await createMyTrustHubSupabaseClient(true);
  if (!client) return { error: 'Account access is unavailable in this environment.' };
  const result = await runAccountOperation(operation, form, client.auth, process.env, outcome => {
    console.info(JSON.stringify({ event: 'my_trusthub_account', operation, outcome }));
  });
  if (result.destination) {
    if (result.completion === 'login') console.info(JSON.stringify({ event: 'auth_continuation_completed', method: 'password', outcome: 'authenticated' }));
    redirect(result.completion === 'login' ? `${result.destination}?auth=complete` : result.destination);
  }
  return result;
}

export async function signOutAccountAction(form?: FormData) {
  const client = await createMyTrustHubSupabaseClient(true);
  let failed = !client;
  try { if (client) failed = Boolean((await client.auth.signOut({ scope: 'local' })).error); }
  catch { failed = true; }
  if (failed) redirect(`/my/sign-in?error=signout&next=${encodeURIComponent(safeReturn(form?.get('next')))}`);
  redirect(`/my/sign-in?next=${encodeURIComponent(safeReturn(form?.get('next')))}`);
}
