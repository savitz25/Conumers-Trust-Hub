'use client';

import { useState } from 'react';

export function HandoffMintForm() {
  const [out, setOut] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    const res = await fetch('/api/internal/handoff/mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nativeProfileId: formData.get('nativeProfileId'),
        slug: formData.get('slug') || undefined,
        externalKey: formData.get('externalKey') || undefined,
      }),
    });
    const json = await res.json();
    if (!json.ok) {
      setError(json.error || 'mint failed');
      return;
    }
    setOut(json.continueUrl);
  }

  return (
    <form action={onSubmit} className="card-surface space-y-3 p-5">
      <label className="block text-sm">
        contractors.id
        <input name="nativeProfileId" required className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      <label className="block text-sm">
        slug (optional if Ask can read CTH)
        <input name="slug" className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      <label className="block text-sm">
        DBPR external key (optional)
        <input name="externalKey" className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button type="submit" className="rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white">
        Mint
      </button>
      {out ? (
        <p className="break-all text-sm">
          <a className="link-inline" href={out}>
            {out}
          </a>
        </p>
      ) : null}
    </form>
  );
}
