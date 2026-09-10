"use client";

import { useEffect, useState, useTransition } from "react";
import { commitGuestSessionImportAction, previewGuestSessionImportAction, type GuestSessionPreviewState } from "@/app/my/actions";
import type { ProjectListRow } from "@/lib/my-trusthub/production-adapter";

export const GUEST_SESSION_STORAGE_KEY = "mytrusthub:guest-sessions:v1";

export function GuestSessionRestore({ projects, importComplete }: { projects: ProjectListRow[]; importComplete: boolean }) {
  const [payload, setPayload] = useState("");
  const [preview, setPreview] = useState<GuestSessionPreviewState | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (importComplete) {
      localStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
      setPayload("");
      return;
    }
    setPayload(localStorage.getItem(GUEST_SESSION_STORAGE_KEY) ?? "");
  }, [importComplete]);

  if (!payload) return null;
  const inspect = () => startTransition(async () => setPreview(await previewGuestSessionImportAction(payload)));

  return (
    <section className="myth-guest" aria-labelledby="guest-session-title">
      <div><p className="myth-eyebrow">FOUND ON THIS DEVICE</p><h2 id="guest-session-title">Restore guest research session</h2><p>Review compatible session state before adding it to this private account.</p></div>
      {!preview ? <button className="myth-secondary" type="button" onClick={inspect} disabled={pending}>{pending ? "Checking…" : "Review session"}</button>
        : preview.ok && preview.items ? (
          <form action={commitGuestSessionImportAction} className="myth-guest-items">
            <input type="hidden" name="payload" value={payload} /><input type="hidden" name="idempotencyKey" value={idempotencyKey} />
            {preview.items.map((item) => <label key={item.client_item_id}><input type="checkbox" name="selectedItemId" value={item.client_item_id} defaultChecked={item.importable} disabled={!item.importable} /><span>{item.client_item_id}</span><small>{item.item_status.replaceAll("_", " ")}</small></label>)}
            {projects.length ? <label><span>Add to Project</span><select name="projectId" defaultValue=""><option value="">Leave Unfiled</option>{projects.map((project) => <option value={project.project_id} key={project.project_id}>{project.name}</option>)}</select></label> : null}
            <button className="myth-primary" type="submit">Restore selected session</button>
          </form>
        ) : <div role="alert"><p>{preview.error}</p><button className="myth-secondary" type="button" onClick={() => setPreview(null)}>Dismiss</button></div>}
    </section>
  );
}
