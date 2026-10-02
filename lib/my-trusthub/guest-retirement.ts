export type ImportAcknowledgment = { ownerId: string; itemIds: string[]; importId: string };
export type ImportCommitResult = { ok: boolean; error?: string; acknowledgment?: ImportAcknowledgment };
type Item = Record<string, unknown>;
function bundle(raw: string): { items: Item[]; [key: string]: unknown } | null {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && Array.isArray(value.items) && value.items.every((v: unknown) => v && typeof v === 'object') ? value : null;
  } catch { return null; }
}
/** Never called from a query marker. Only a successful server-action receipt can retire items. */
export function retireAcknowledged(currentRaw: string, submittedRaw: string, selected: string[], acknowledgment: ImportAcknowledgment | undefined, expectedOwner: string): string {
  if (!acknowledgment || acknowledgment.ownerId !== expectedOwner || !acknowledgment.importId) return currentRaw;
  const current = bundle(currentRaw), submitted = bundle(submittedRaw);
  if (!current || !submitted || current.version !== submitted.version) return currentRaw;
  const accepted = new Set(acknowledgment.itemIds.filter(id => selected.includes(id)));
  const items = current.items.filter(item => {
    const id = item.client_item_id;
    if (typeof id !== 'string' || !accepted.has(id)) return true;
    const originals = submitted.items.filter(v => v.client_item_id === id);
    if (originals.length !== 1 || current.items.filter(v => v.client_item_id === id).length !== 1) return true;
    return JSON.stringify(originals[0]) !== JSON.stringify(item); // Preserve edits made during import.
  });
  return items.length === current.items.length ? currentRaw : JSON.stringify({ ...current, items });
}
export async function importRequestKey(owner: string, raw: string, selected: string[], project: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([owner, raw, [...selected].sort(), project])));
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const s = [...bytes].map(v => v.toString(16).padStart(2, '0')).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
