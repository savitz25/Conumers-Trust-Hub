"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AUTHORITY_EVIDENCE,
  type AuthorityEvidenceCode,
  type ClaimDecisionCategory,
} from "@/lib/customer/claim-governance";
const categories: ClaimDecisionCategory[] = [
  "AUTHORITY_VERIFIED",
  "AUTHORITY_EVIDENCE_MISSING",
  "AUTHORITY_NOT_ESTABLISHED",
  "IDENTITY_CONFLICT",
  "UNRESOLVED_COMPETING_CLAIM",
  "INELIGIBLE_RELATIONSHIP",
  "PROFILE_NO_LONGER_ELIGIBLE",
  "DUPLICATE_EXISTING_AUTHORITY",
  "OTHER_POLICY_REASON",
];
export function ReviewActions({
  claimId,
  grantId,
}: {
  claimId: string;
  grantId?: string;
}) {
  const router = useRouter(),
    [evidenceCodes, setEvidenceCodes] = useState<AuthorityEvidenceCode[]>([]),
    [evidenceNote, setEvidenceNote] = useState(""),
    [internalRationale, setInternalRationale] = useState(""),
    [claimantMessage, setClaimantMessage] = useState(""),
    [reasonCategory, setReasonCategory] = useState<ClaimDecisionCategory>(
      "AUTHORITY_EVIDENCE_MISSING",
    ),
    [revocationReason, setRevocationReason] = useState(""),
    [accountFacingReason, setAccountFacingReason] = useState("Your access to this organization profile has changed. Contact Ask Trust Hub support if you believe this is an error."),
    [error, setError] = useState<string | null>(null),
    [pending, setPending] = useState(false);
  function toggle(code: AuthorityEvidenceCode) {
    setEvidenceCodes((c) =>
      c.includes(code) ? c.filter((x) => x !== code) : [...c, code],
    );
  }
  async function decide(decision: "approve" | "reject" | "needs_info") {
    setPending(true);
    setError(null);
    const r = await fetch(`/api/internal/review/${claimId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          evidenceCodes,
          evidenceNote,
          internalRationale,
          claimantMessage,
          reasonCategory,
        }),
      }),
      j = (await r.json()) as { ok?: boolean; error?: string };
    setPending(false);
    if (!j.ok) {
      setError(j.error || "Decision failed");
      return;
    }
    router.refresh();
  }
  async function revoke() {
    if (!grantId) return;
    setPending(true);
    setError(null);
    const r = await fetch(`/api/internal/review/${claimId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId, internalReason: revocationReason, accountFacingReason }),
      }),
      j = (await r.json()) as { ok?: boolean; error?: string };
    setPending(false);
    if (!j.ok) {
      setError(j.error || "Revocation failed");
      return;
    }
    router.refresh();
  }
  return (
    <div className="card-surface space-y-5 p-5">
      <section>
        <h2 className="font-semibold">Authority evidence</h2>
        <p className="text-sm text-muted-foreground">
          Nothing is preselected. Public credential knowledge and company-domain
          email alone are insufficient.
        </p>
        <fieldset className="mt-3 space-y-2">
          <legend className="sr-only">Evidence checked</legend>
          {Object.entries(AUTHORITY_EVIDENCE).map(([code, item]) => (
            <label className="flex gap-2 text-sm" key={code}>
              <input
                type="checkbox"
                checked={evidenceCodes.includes(code as AuthorityEvidenceCode)}
                onChange={() => toggle(code as AuthorityEvidenceCode)}
              />
              <span>
                {item.label}{" "}
                <span className="text-muted-foreground">({item.strength})</span>
              </span>
            </label>
          ))}
        </fieldset>
      </section>
      <label className="block text-sm font-medium">
        Evidence/source note
        <textarea
          value={evidenceNote}
          onChange={(e) => setEvidenceNote(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
          rows={3}
        />
      </label>
      <label className="block text-sm font-medium">
        Internal rationale
        <textarea
          value={internalRationale}
          onChange={(e) => setInternalRationale(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
          rows={3}
        />
      </label>
      <label className="block text-sm font-medium">
        Claimant-facing message
        <textarea
          value={claimantMessage}
          onChange={(e) => setClaimantMessage(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
          rows={3}
        />
      </label>
      <label className="block text-sm font-medium">
        Decision category
        <select
          value={reasonCategory}
          onChange={(e) =>
            setReasonCategory(e.target.value as ClaimDecisionCategory)
          }
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
        >
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide("approve")}
          className="rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide("needs_info")}
          className="rounded-lg border border-border px-4 py-2 text-sm"
        >
          Needs more information
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide("reject")}
          className="rounded-lg border border-border px-4 py-2 text-sm"
        >
          Reject
        </button>
      </div>
      {grantId ? (
        <section className="border-t border-border pt-4">
          <h2 className="font-semibold text-destructive">
            Revoke management access
          </h2>
          <p className="text-sm text-muted-foreground">
            Revocation preserves the claim, public evidence, and audit history.
            Access ends immediately.
          </p>
          <label className="mt-2 block text-sm">
            Mandatory internal reason
            <textarea
              value={revocationReason}
              onChange={(e) => setRevocationReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              rows={3}
            />
          </label>
          <label className="mt-2 block text-sm">Account-facing reason<textarea value={accountFacingReason} onChange={(e)=>setAccountFacingReason(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2" rows={3}/></label>
          <button
            type="button"
            disabled={pending}
            onClick={revoke}
            className="mt-2 rounded-lg border border-destructive px-4 py-2 text-sm text-destructive"
          >
            Confirm revoke access
          </button>
        </section>
      ) : null}
    </div>
  );
}
