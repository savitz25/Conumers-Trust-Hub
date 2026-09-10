"use client";

import { useEffect, useState, useTransition } from "react";
import {
  commitGuestImportAction,
  previewGuestImportAction,
  type GuestPreviewState,
} from "@/app/my/actions";
import type { ProjectListRow } from "@/lib/my-trusthub/production-adapter";

export const GUEST_RESEARCH_STORAGE_KEY = "mytrusthub:guest-research:v1";

export function GuestRestore({
  projects,
  importComplete,
}: {
  projects: ProjectListRow[];
  importComplete: boolean;
}) {
  const [payload, setPayload] = useState("");
  const [preview, setPreview] = useState<GuestPreviewState | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (importComplete) {
      window.localStorage.removeItem(GUEST_RESEARCH_STORAGE_KEY);
      setPayload("");
      return;
    }
    setPayload(window.localStorage.getItem(GUEST_RESEARCH_STORAGE_KEY) ?? "");
  }, [importComplete]);

  if (!payload) return null;

  function inspect() {
    startTransition(async () => setPreview(await previewGuestImportAction(payload)));
  }

  return (
    <section className="myth-guest" aria-labelledby="guest-restore-title">
      <div>
        <p className="myth-eyebrow">FOUND ON THIS DEVICE</p>
        <h2 id="guest-restore-title">Restore guest research</h2>
        <p>Review supported anonymous Saves before adding them to this private account.</p>
      </div>
      {!preview ? (
        <button className="myth-secondary" type="button" onClick={inspect} disabled={pending}>
          {pending ? "Checking…" : "Review research"}
        </button>
      ) : preview.ok && preview.items ? (
        <form action={commitGuestImportAction} className="myth-guest-items">
          <input type="hidden" name="payload" value={payload} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          {preview.items.map((item) => (
            <label key={item.client_item_id}>
              <input
                type="checkbox"
                name="selectedItemId"
                value={item.client_item_id}
                defaultChecked={item.importable}
                disabled={!item.importable}
              />
              <span>{item.client_item_id}</span>
              <small>{item.item_status.replaceAll("_", " ")}</small>
            </label>
          ))}
          {projects.length ? (
            <label>
              <span>Add to Project</span>
              <select name="projectId" defaultValue="">
                <option value="">Leave Unfiled</option>
                {projects.map((project) => (
                  <option value={project.project_id} key={project.project_id}>{project.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <button className="myth-primary" type="submit">Restore selected research</button>
        </form>
      ) : (
        <div role="alert">
          <p>{preview.error}</p>
          <button className="myth-secondary" type="button" onClick={() => setPreview(null)}>Dismiss</button>
        </div>
      )}
    </section>
  );
}
