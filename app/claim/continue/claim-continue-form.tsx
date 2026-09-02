'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RelationshipType } from '@/lib/customer/types';

export function ClaimContinueForm({
  authed,
  email,
  relationships,
  expectedCredential,
  organizations,
  identifierLabel,
}: {
  authed: boolean;
  email: string;
  relationships: [RelationshipType, string][];
  expectedCredential: string;
  organizations: { id: string; display_name: string }[];
  identifierLabel:string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function requestLink(formData: FormData) {
    setPending(true);
    setError(null);
    const res = await fetch('/api/customer/auth/request-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: String(formData.get('email') || ''),
        next: '/claim/continue',
      }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string; sent?: boolean };
    setPending(false);
    if (!json.ok) {
      setError(json.error || 'Could not send the confirmation email.');
      return;
    }
    setSent(true);
  }

  async function submitClaim(formData: FormData) {
    setPending(true);
    setError(null);
    const res = await fetch('/api/customer/claim/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        relationshipType: formData.get('relationshipType'),
        legalName: formData.get('legalName'),
        credentialAttestation: formData.get('credentialAttestation'),
        authorized: formData.get('authorized') === 'on',
        orgId: formData.get('orgId') || undefined,
      }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string; claimId?: string };
    setPending(false);
    if (!json.ok || !json.claimId) {
      setError(json.error || 'Could not submit this request.');
      return;
    }
    router.push(`/claim/status/${json.claimId}`);
  }

  if (!authed) {
    return (
      <form action={requestLink} className="card-surface space-y-4 p-5">
        <h2 className="text-base font-semibold">Confirm your AskTrustHub business account</h2>
        <p className="text-sm text-muted-foreground">
          Confirming your email does not verify that you own or manage a business.
        </p>
        <label className="block text-sm font-medium">
          Work email
          <input
            required
            type="email"
            name="email"
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2"
          />
        </label>
        {sent ? (
          <p className="text-sm text-foreground">Check your email for a one-time confirmation link.</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-indigo px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Send confirmation link'}
        </button>
      </form>
    );
  }

  return (
    <form action={submitClaim} className="card-surface space-y-4 p-5">
      <p className="text-sm text-muted-foreground">Signed in as {email}</p>
      {organizations.length?<label className="block text-sm font-medium">Organization for this profile<select name="orgId" className="mt-1 min-h-11 w-full rounded-lg border border-border bg-white px-3"><option value="">Create a new organization</option>{organizations.map(org=><option key={org.id} value={org.id}>{org.display_name}</option>)}</select><span className="mt-1 block text-xs font-normal text-muted-foreground">Choose an organization you already own to avoid duplicate business organizations.</span></label>:null}
      <label className="block text-sm font-medium">
        How are you connected to this business?
        <select
          name="relationshipType"
          className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2"
          defaultValue="owner"
        >
          {relationships.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">This is an attestation. Choosing a role does not prove it.</p>
      <label className="block text-sm font-medium">
        Legal or operating name
        <input name="legalName" className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Confirm the {identifierLabel} for this profile
        <input
          required
          name="credentialAttestation"
          defaultValue={expectedCredential}
          className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2"
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="authorized" required className="mt-1" />
        <span>
          I am authorized to request management of business-supplied information for this specific
          profile. I understand this is not a TrustHub endorsement.
        </span>
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-indigo px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Submitting…' : 'Submit request for review'}
      </button>
    </form>
  );
}
