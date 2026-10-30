'use client';

import { useState, type FormEvent } from 'react';
import { TurnstileField } from './turnstile-field';

export const TURNSTILE_QA_SITEKEY = '3x00000000000000000000FF';

/** Development-only sign-in shell: submitting never calls an auth service. */
export function TurnstileBrowserFixture() {
  const [message, setMessage] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('Mock authentication complete. No account service was called.');
  };

  return (
    <main className="myth-auth-page" data-testid="turnstile-qa-page">
      <section className="myth-auth-card" aria-labelledby="turnstile-qa-title">
        <p className="myth-eyebrow">MY TRUSTHUB · LOCAL QA</p>
        <h1 id="turnstile-qa-title">Sign in to My TrustHub</h1>
        <p>This isolated fixture uses mock authentication and a Cloudflare test sitekey.</p>
        <form className="myth-form" onSubmit={submit}>
          <label htmlFor="qa-email">Email</label>
          <input id="qa-email" name="email" type="email" autoComplete="username" />
          <label htmlFor="qa-password">Password</label>
          <input id="qa-password" name="password" type="password" autoComplete="current-password" />
          <TurnstileField siteKey={TURNSTILE_QA_SITEKEY} />
          <p role="status" aria-live="polite" data-testid="mock-auth-status">{message}</p>
          <button className="myth-primary" type="submit">Sign in</button>
        </form>
      </section>
    </main>
  );
}
