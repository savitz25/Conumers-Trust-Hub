'use client';
import { GuestImport } from './guest-import';
import type { ProjectListRow } from '@/lib/my-trusthub/production-adapter';
export const GUEST_SESSION_STORAGE_KEY = 'mytrusthub:guest-sessions:v1';
export function GuestSessionRestore(props: { projects: ProjectListRow[]; ownerId: string; ownerLabel: string }) {
  return <GuestImport key={props.ownerId} {...props} storageKey={GUEST_SESSION_STORAGE_KEY} sessions={true} />;
}
