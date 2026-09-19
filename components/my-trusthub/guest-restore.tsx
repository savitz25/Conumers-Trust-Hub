'use client';
import { GuestImport } from './guest-import';
import type { ProjectListRow } from '@/lib/my-trusthub/production-adapter';
export const GUEST_RESEARCH_STORAGE_KEY = 'mytrusthub:guest-research:v1';
export function GuestRestore(props: { projects: ProjectListRow[]; ownerId: string; ownerLabel: string }) {
  return <GuestImport key={props.ownerId} {...props} storageKey={GUEST_RESEARCH_STORAGE_KEY} sessions={false} />;
}
