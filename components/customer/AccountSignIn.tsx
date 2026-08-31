'use client';

import { useState } from 'react';

export function AccountSignIn({ nextPath = '/manage' }: { nextPath?: string }) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState('');

  async function requestLink(formData: FormData) {
    setPending(true);
    setStatus('');
    const response = await fetch('/api/customer/auth/request-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: formData.get('email'), next: nextPath }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (response.ok) {
      setSent(true);
      return;
    }
    setStatus(result.error === 'rate_limited' ? 'Please wait before requesting another link.' : 'We could not send a sign-in link. Please try again.');
  }

  return (
    <form action={requestLink} className="mt-5 space-y-3">
      <label className="block text-sm font-medium text-navy">
        Account email
        <input
          required
          autoComplete="email"
          inputMode="email"
          type="email"
          name="email"
          className="mt-1 min-h-11 w-full rounded-lg border border-border bg-white px-3"
        />
      </label>
      <button disabled={pending} className="min-h-11 w-full rounded-lg bg-navy px-4 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {sent ? <p className="text-sm text-muted-foreground" role="status">Check your email for a secure sign-in link.</p> : null}
      <p aria-live="polite" className="text-sm text-destructive">{status}</p>
    </form>
  );
}
