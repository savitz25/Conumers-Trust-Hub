'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { accountAction } from '@/app/my/account-actions';
import type { AccountOperation, AccountResult } from '@/lib/my-trusthub/account-service';
import { TurnstileField } from './turnstile-field';
import { AnalyticsForm } from '@/components/analytics/analytics-form';

const LABELS: Record<AccountOperation, string> = { signup: 'Create account', login: 'Sign in', link: 'Email me a sign-in link', recovery: 'Send recovery instructions', password: 'Save password and sign out' };
export function AccountForm({ operation, next, siteKey, expectedUserId }: { operation: AccountOperation; next: string; siteKey?: string; expectedUserId?: string }) {
  const [state, action, pending] = useActionState<AccountResult, FormData>(accountAction.bind(null, operation), {});
  const [show, setShow] = useState(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (state.error || state.message) feedback.current?.focus(); }, [state]);
  const hasPassword = ['signup', 'login', 'password'].includes(operation);
  const newPassword = operation !== 'login';
  const body = <>
    <input type="hidden" name="next" value={next} />
    {expectedUserId ? <input type="hidden" name="expectedUserId" value={expectedUserId} /> : null}
    {operation !== 'password' ? <><label htmlFor={`${operation}-email`}>Email</label><input id={`${operation}-email`} name="email" type="email" autoComplete="username" required maxLength={254} data-ph-mask="true" /></> : null}
    {hasPassword ? <>
      <label htmlFor={`${operation}-password`}>{newPassword ? 'New password' : 'Password'}</label>
      <input id={`${operation}-password`} name="password" type={show ? 'text' : 'password'} autoComplete={newPassword ? 'new-password' : 'current-password'} required minLength={newPassword ? 12 : undefined} maxLength={128} aria-describedby={newPassword ? `${operation}-password-help` : undefined} data-ph-mask="true" />
      <button type="button" className="myth-secondary" aria-pressed={show} aria-controls={`${operation}-password`} onClick={() => setShow(v => !v)}>{show ? 'Hide password' : 'Show password'}</button>
      {newPassword ? <><p id={`${operation}-password-help`} className="myth-muted">Use 12–128 characters. A password manager can create and remember a strong password for you.</p><label htmlFor={`${operation}-confirm`}>Confirm new password</label><input id={`${operation}-confirm`} name="confirmPassword" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={128} data-ph-mask="true" /></> : null}
    </> : null}
    {operation !== 'password' ? siteKey ? <TurnstileField siteKey={siteKey} resetKey={state} /> : <p role="status">Security verification is unavailable. Account requests are paused in this environment.</p> : null}
    <p ref={feedback} tabIndex={-1} role={state.error ? 'alert' : 'status'} className={state.error ? 'myth-warning' : 'myth-notice'}>{state.error ?? state.message ?? (pending ? 'Working securely…' : '')}</p>
    <button className="myth-primary" type="submit" disabled={pending || (operation !== 'password' && !siteKey)}>{pending ? 'Please wait…' : LABELS[operation]}</button>
  </>;
  const analyticsEvent = operation === 'signup' ? 'account_signup_started' : operation === 'login' || operation === 'link' ? 'account_login_started' : null;
  return analyticsEvent ? <AnalyticsForm action={action} className="myth-form" analyticsEvent={analyticsEvent}>{body}</AnalyticsForm> : <form action={action} className="myth-form">{body}</form>;
}
