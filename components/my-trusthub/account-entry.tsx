import Link from 'next/link';
import { accountFormAvailable, accessMode, admitted, enabled, safeReturn } from '@/lib/my-trusthub/account-policy';
import type { AccountOperation } from '@/lib/my-trusthub/account-service';
import { createMyTrustHubSupabaseClient } from '@/lib/supabase/server';
import { signOutAccountAction } from '@/app/my/account-actions';
import { AccountForm } from './account-form';

export type AccountQuery = Record<string, string | string[] | undefined>;
export async function AccountEntry({ operation, query }: { operation: AccountOperation; query: AccountQuery }) {
  const next = safeReturn(query.next);
  const available = accountFormAvailable(operation, process.env);
  const client = available ? await createMyTrustHubSupabaseClient() : null;
  const user = client ? (await client.auth.getUser()).data.user : null;
  const allowed = admitted(user, process.env);
  const mode = accessMode(process.env);
  const titles: Record<AccountOperation, string> = { signup: 'Create your My TrustHub account', login: 'Sign in to My TrustHub', link: 'Sign in with an email link', recovery: 'Recover your account', password: 'Set your password' };
  const href = (path: string) => `${path}?next=${encodeURIComponent(next)}`;
  return <main className="myth-auth-page"><section className="myth-auth-card" aria-labelledby="account-title">
    <p className="myth-eyebrow">MY TRUSTHUB</p><h1 id="account-title">{titles[operation]}</h1>
    <p>Keep your research in your private workspace. Creating an account does not automatically copy research from other TrustHub sites.</p>
    {mode === 'internal' ? <p>Access is restricted to approved internal accounts. Public signup is disabled.</p> : mode === 'invitation' ? <p>Access is by approved invitation. Existing eligible users can sign in while new registration is paused.</p> : null}
    {!enabled(process.env.MY_TRUSTHUB_SIGNUP_ENABLED) ? <p>New registration is currently paused. Eligible existing users can still sign in.</p> : null}
    {query.sent === '1' ? <p role="status">If this address is eligible, we&apos;ll email a sign-in link.</p> : null}
    {query.error === 'signout' ? <p role="alert">Sign-out could not be confirmed. Please retry before switching accounts or leaving a shared device.</p> : query.error || query.access === 'restricted' ? <p role="alert">We could not finish sign-in safely. The link may be invalid, expired or already used. Request a fresh link or sign in again. Your local research has not been removed.</p> : null}
    {!available || !client ? <p role="status">Account access is unavailable in this environment. You can continue researching without an account.</p> : user && operation !== 'password' ? <>
      <p data-ph-mask="true">You are signed in as {user.email ?? 'an existing account'}.</p>
      {allowed ? <Link href={next}>Continue to your task</Link> : <p>This account is not eligible for this workspace.</p>}
      <form action={signOutAccountAction}><input type="hidden" name="next" value={next} /><button className="myth-secondary">Sign out to use another account</button></form>
    </> : operation === 'password' && !allowed ? <p>Sign in again or use a fresh recovery email before setting a password.</p> : <>
      {operation === 'password' ? <p data-ph-mask="true">Changing the password for {user?.email}. Your account and saved research stay the same. A recent verified sign-in is required.</p> : null}
      <AccountForm operation={operation} next={next} expectedUserId={operation === 'password' ? user?.id : undefined} siteKey={process.env.NEXT_PUBLIC_MY_TRUSTHUB_TURNSTILE_SITE_KEY} />
    </>}
    <nav aria-label="Account options" className="myth-account-options">
      <Link href={href('/my/create-account')}>Create account</Link>
      <Link href={href('/my/sign-in')}>Already have an account? Sign in</Link>
      <Link href={href('/my/email-link')}>Email me a sign-in link instead</Link>
      <Link href={href('/my/recover')}>Forgot your password?</Link>
    </nav>
    <p>Your consumer workspace is separate from business access. Saves and Projects never start a Watch.</p>
    <Link href="/">Continue researching on Ask Trust Hub</Link>
  </section></main>;
}
