"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * ATH-CLAIM-V2-001 — bounded explicit reviewer timer. Human review minutes are measured only while a reviewer
 * has declared an active session; each session is capped when closed and a decision closes it automatically.
 */
export function ReviewTimer({
  claimId,
  openSession,
  humanReviewActiveSeconds,
  evidenceReady,
  firstReview,
  canWrite,
}: {
  claimId: string;
  openSession: boolean;
  humanReviewActiveSeconds: number;
  evidenceReady: boolean | null;
  firstReview: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState<"yes" | "no" | "">(evidenceReady === true ? "yes" : evidenceReady === false ? "no" : "");
  async function call(action: "start" | "stop") {
    setPending(true);
    setError("");
    const r = await fetch(`/api/admin/operations/claims/${claimId}/review-session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, evidenceReady: ready === "" ? null : ready === "yes" }),
    });
    const j = await r.json().catch(() => ({}));
    setPending(false);
    if (!r.ok) {
      setError(j.error ?? "Timer action failed");
      return;
    }
    router.refresh();
  }
  const minutes = Math.round((humanReviewActiveSeconds / 60) * 10) / 10;
  return (
    <section className="card-surface space-y-3 p-5">
      <h3 className="text-lg font-semibold text-navy">Review timer (human handling time)</h3>
      <p className="text-sm text-muted-foreground">
        Recorded human review time: <strong>{minutes} min</strong>. Wall-clock claim age is reported separately and is not labor time.
      </p>
      {firstReview ? (
        <fieldset className="text-sm">
          <legend className="font-semibold">Was the evidence ready at first review?</legend>
          <div className="mt-1 flex gap-4">
            {(["yes", "no"] as const).map((v) => (
              <label key={v} className="flex min-h-11 items-center gap-2">
                <input type="radio" name="evidence-ready" value={v} checked={ready === v} onChange={() => setReady(v)} disabled={!canWrite || openSession} />
                {v === "yes" ? "Yes" : "No"}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="text-sm">Evidence ready at first review: <strong>{evidenceReady === null ? "Not recorded" : evidenceReady ? "Yes" : "No"}</strong></p>
      )}
      {canWrite ? (
        <div className="flex flex-wrap gap-3">
          {openSession ? (
            <button type="button" disabled={pending} onClick={() => call("stop")} className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold">Stop timer</button>
          ) : (
            <button type="button" disabled={pending || (firstReview && ready === "")} onClick={() => call("start")} className="inline-flex min-h-11 items-center rounded-lg bg-indigo px-4 text-sm font-semibold text-white disabled:opacity-60">Start review timer</button>
          )}
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
