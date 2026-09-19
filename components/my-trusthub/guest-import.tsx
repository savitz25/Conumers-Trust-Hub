'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { commitGuestImportAction, commitGuestSessionImportAction, previewGuestImportAction, previewGuestSessionImportAction } from '@/app/my/actions';
import { importRequestKey, retireAcknowledged } from '@/lib/my-trusthub/guest-retirement';
import type { ProjectListRow } from '@/lib/my-trusthub/production-adapter';
import { captureGuestImportSaveIntent, captureMyTrustHubJourneyEvent } from '@/components/analytics/ask-instrumentation';
import { MY_TRUSTHUB_EVENTS } from '@/lib/analytics/my-trusthub-contract';

type Preview = { ok: boolean; error?: string; items?: { client_item_id: string; item_status: string; importable: boolean }[] };
export function GuestImport({ storageKey, sessions, projects, ownerId, ownerLabel }: { storageKey: string; sessions: boolean; projects: ProjectListRow[]; ownerId: string; ownerLabel: string }) {
  const [payload, setPayload] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const feedback = useRef<HTMLParagraphElement>(null);
  const router = useRouter();
  useEffect(() => { try { setPayload(localStorage.getItem(storageKey) ?? ''); } catch { setMessage('Device storage is unavailable. No local research was changed.'); } }, [storageKey, ownerId]);
  useEffect(() => { if (message) feedback.current?.focus(); }, [message]);
  const inspect = () => startTransition(async () => {
    try {
      const raw = localStorage.getItem(storageKey) ?? '';
      setPayload(raw);
      setPreview(await (sessions ? previewGuestSessionImportAction(raw) : previewGuestImportAction(raw)));
    } catch { setMessage('Research could not be reviewed. Your local data is unchanged.'); }
  });
  const submit = (form: FormData) => startTransition(async () => {
    const selected = form.getAll('selectedItemId').map(String);
    const project = String(form.get('projectId') ?? '');
    if (!selected.length) { setMessage('Select the research you want to import.'); return; }
    try {
      // Snapshot shown in the preview stays fixed. New edits are retained at acknowledgment.
      form.set('payload', payload); form.set('expectedUserId', ownerId);
      form.set('idempotencyKey', await importRequestKey(ownerId, payload, selected, project));
      try { if (!sessions) captureGuestImportSaveIntent(Boolean(project)); } catch { /* optional analytics */ }
      const result = await (sessions ? commitGuestSessionImportAction(form) : commitGuestImportAction(form));
      if (!result.ok || !result.acknowledgment) { setMessage(result.error ?? 'Import could not be confirmed. Local research is unchanged.'); return; }
      const current = localStorage.getItem(storageKey) ?? '';
      const retained = retireAcknowledged(current, payload, selected, result.acknowledgment, ownerId);
      if (retained !== current) localStorage.setItem(storageKey, retained);
      setPayload(retained); setPreview(null);
      const accepted = result.acknowledgment.itemIds.filter(id => selected.includes(id));
      setMessage(`${accepted.length} selected item(s) confirmed in the displayed account. Unselected, unsupported and edited local research was kept.`);
      try {
        if (!sessions && accepted.length) captureMyTrustHubJourneyEvent(MY_TRUSTHUB_EVENTS.PROFILE_SAVED, { surface: 'my_saved', action_source: 'guest_import', auth_state: 'authenticated', outcome: 'success', project_context_present: Boolean(project) });
      } catch { /* receipt handling must not depend on analytics */ }
      router.refresh();
    } catch { setMessage('Import or local cleanup could not be confirmed. Research was not intentionally removed. Review your Saved research and retry safely.'); }
  });
  if (!payload && !message) return null;
  return <section className="myth-guest" aria-label={sessions ? 'Import guest sessions' : 'Import guest research'}>
    <h2>{sessions ? 'Restore guest research session' : 'Restore guest research'}</h2>
    <p>This device only. Review your selection before adding it to your private workspace.</p>
    <p data-ph-mask="true">Destination account: {ownerLabel}</p>
    <p ref={feedback} tabIndex={-1} role="status">{message}</p>
    {!preview ? <button type="button" className="myth-secondary" disabled={pending || !payload} onClick={inspect}>{pending ? 'Checking…' : 'Review research'}</button> : preview.ok && preview.items ? <form action={submit} className="myth-guest-items">
      {preview.items.map(item => <label key={item.client_item_id}><input name="selectedItemId" type="checkbox" value={item.client_item_id} defaultChecked={false} disabled={!item.importable || pending} /><span>{item.client_item_id}</span><small>{item.item_status.replaceAll('_', ' ')}</small></label>)}
      {projects.length ? <label>Add to Project (optional)<select name="projectId" disabled={pending}><option value="">Leave Unfiled</option>{projects.map(p => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}</select></label> : null}
      <button className="myth-primary" disabled={pending}>{pending ? 'Importing…' : 'Import selected research into this account'}</button>
      <button type="button" className="myth-secondary" disabled={pending} onClick={() => setPreview(null)}>Review again</button>
    </form> : <p role="alert">{preview.error}</p>}
  </section>;
}
