"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AUTHORITY_EVIDENCE,
  type AuthorityEvidenceCode,
  CLAIM_DECISION_CATEGORIES,
  type ClaimDecisionCategory,
} from "@/lib/customer/claim-governance";
export function ClaimDecisionForm({
  claimId,
  grantId,
  policyResult,
}: {
  claimId: string;
  grantId?: string;
  policyResult: string;
}) {
  const router = useRouter(),
    [codes, setCodes] = useState<AuthorityEvidenceCode[]>([]),
    [evidenceNote, setEvidence] = useState(""),
    [internalRationale, setInternal] = useState(""),
    [claimantMessage, setMessage] = useState(""),
    [reasonCategory, setCategory] = useState<ClaimDecisionCategory>(
      "AUTHORITY_EVIDENCE_MISSING",
    ),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [revocationReason, setRevocation] = useState(""),
    [accountReason, setAccount] = useState(
      "Your access to this organization profile has changed. Contact Ask Trust Hub support if you believe this is an error.",
    );
  async function decide(decision: "approve" | "reject" | "needs_info") {
    setPending(true);
    setError("");
    const r = await fetch(`/api/admin/operations/claims/${claimId}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          decision,
          evidenceCodes: codes,
          evidenceNote,
          internalRationale,
          claimantMessage,
          reasonCategory,
        }),
      }),
      j = await r.json();
    setPending(false);
    if (!r.ok) {
      setError(j.error ?? "Decision failed");
      return;
    }
    router.refresh();
  }
  async function revoke() {
    if (!grantId) return;
    setPending(true);
    const r = await fetch(`/api/admin/operations/claims/${claimId}/revoke`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          grantId,
          internalReason: revocationReason,
          accountFacingReason: accountReason,
        }),
      }),
      j = await r.json();
    setPending(false);
    if (!r.ok) {
      setError(j.error ?? "Revocation failed");
      return;
    }
    router.refresh();
  }
  return (
    <section className="card-surface space-y-5 p-5">
      <div>
        <h3 className="text-lg font-semibold text-navy">Reviewer decision</h3>
        <p className="text-sm text-muted-foreground">
          Policy is {policyResult}. Approval is accepted only after selected
          evidence evaluates GREEN. Internal rationale is never claimant-facing.
        </p>
      </div>
      <fieldset>
        <legend className="font-semibold">Structured authority evidence</legend>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {Object.entries(AUTHORITY_EVIDENCE).map(([code, item]) => (
            <label className="flex min-h-11 gap-2 text-sm" key={code}>
              <input
                type="checkbox"
                checked={codes.includes(code as AuthorityEvidenceCode)}
                onChange={() =>
                  setCodes((v) =>
                    v.includes(code as AuthorityEvidenceCode)
                      ? v.filter((x) => x !== code)
                      : [...v, code as AuthorityEvidenceCode],
                  )
                }
              />
              <span>
                {item.label} ({item.strength})
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Text
        label="Evidence/source note"
        value={evidenceNote}
        set={setEvidence}
      />
      <Text
        label="Internal rationale"
        value={internalRationale}
        set={setInternal}
      />
      <Text
        label="Claimant-facing message"
        value={claimantMessage}
        set={setMessage}
      />
      <label className="block text-sm font-semibold">
        Decision category
        <select
          className="mt-1 min-h-11 w-full rounded-lg border px-3"
          value={reasonCategory}
          onChange={(e) => setCategory(e.target.value as ClaimDecisionCategory)}
        >
          {CLAIM_DECISION_CATEGORIES.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={pending}
          onClick={() => decide("approve")}
          className="min-h-11 rounded-lg bg-indigo px-4 text-sm font-semibold text-white"
        >
          Approve
        </button>
        <button
          disabled={pending}
          onClick={() => decide("needs_info")}
          className="min-h-11 rounded-lg border px-4 text-sm"
        >
          Needs information
        </button>
        <button
          disabled={pending}
          onClick={() => decide("reject")}
          className="min-h-11 rounded-lg border px-4 text-sm"
        >
          Reject
        </button>
      </div>
      {grantId ? (
        <div className="border-t pt-4">
          <h3 className="font-semibold text-destructive">
            Revoke exact-profile management grant
          </h3>
          <Text
            label="Mandatory internal reason"
            value={revocationReason}
            set={setRevocation}
          />
          <Text
            label="Account-facing reason"
            value={accountReason}
            set={setAccount}
          />
          <button
            disabled={pending}
            onClick={revoke}
            className="mt-2 min-h-11 rounded-lg border border-destructive px-4 text-sm text-destructive"
          >
            Revoke access
          </button>
        </div>
      ) : null}
    </section>
  );
}
function Text({
  label,
  value,
  set,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <textarea
        className="mt-1 w-full rounded-lg border px-3 py-2"
        rows={3}
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
}
