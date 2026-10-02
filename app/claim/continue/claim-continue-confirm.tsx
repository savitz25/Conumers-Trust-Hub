'use client';

import { useState } from 'react';

/**
 * ATH-CLAIM-V2-001 — the EXPLICIT CONTINUE action. A plain form post (works without JavaScript); with
 * JavaScript the button disables itself after the first activation so a double-click sends one request.
 * The server is idempotent for the same receipt anyway.
 */
export function ClaimContinueConfirm({ profileHref, confirmationKey }: { profileHref: string; confirmationKey: string }) {
  const [pending, setPending] = useState(false);
  return (
    <form
      method="post"
      action="/api/customer/claim/confirm"
      className="card-surface space-y-4 p-5"
      onSubmit={(event) => {
        if (pending) { event.preventDefault(); return; }
        setPending(true);
      }}
    >
      <input type="hidden" name="confirmation" value={confirmationKey} />
      <h2 className="text-base font-semibold">Continue to request management access</h2>
      <p className="text-sm text-muted-foreground">
        Continuing records that you intend to request management access for this exact profile. You will then
        confirm a work email and attest to your relationship. Claiming is free and is not an endorsement.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-indigo px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Continuing…' : 'Continue'}
      </button>
      <p className="text-sm">
        <a className="link-inline" href={profileHref}>Not your business? Return to the public profile</a>
      </p>
    </form>
  );
}
