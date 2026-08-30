'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ReviewActions({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState('License key matches the pointed Florida DBPR credential.');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function decide(decision: 'approve' | 'reject' | 'needs_info') {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/internal/review/${claimId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reason }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    setPending(false);
    if (!json.ok) {
      setError(json.error || 'Decision failed');
      return;
    }
    router.refresh();
  }

  return (
    <div className="card-surface space-y-3 p-5">
      <label className="block text-sm font-medium">
        Reason shown to the claimant
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
          rows={3}
        />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide('approve')}
          className="rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide('needs_info')}
          className="rounded-lg border border-border px-4 py-2 text-sm"
        >
          Needs more information
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide('reject')}
          className="rounded-lg border border-border px-4 py-2 text-sm"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
