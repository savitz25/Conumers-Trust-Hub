/**
 * Runtime validation for NetworkDiscoveryEntity fixtures (ASK-SEARCH-005).
 */

import { CANONICAL_ORIGINS, isSpecialistHubId } from '../../network/registry';
import { parseNetworkEntityId } from './identity';
import type { NetworkDiscoveryEntity } from './types';

export type DiscoveryValidationIssue = {
  path: string;
  message: string;
};

const SPECIALIST_HOSTS = new Set(
  Object.entries(CANONICAL_ORIGINS)
    .filter(([id]) => id !== 'ask')
    .map(([, url]) => new URL(url).hostname)
);

export function validateDiscoveryEntity(
  entity: unknown,
  path = 'entity'
): DiscoveryValidationIssue[] {
  const issues: DiscoveryValidationIssue[] = [];
  if (!entity || typeof entity !== 'object') {
    return [{ path, message: 'entity must be an object' }];
  }
  const e = entity as Record<string, unknown>;

  for (const req of [
    'network_entity_id',
    'hub',
    'source_entity_id',
    'entity_type',
    'display_name',
    'canonical_profile_url',
  ]) {
    if (e[req] === undefined || e[req] === null || e[req] === '') {
      issues.push({ path: `${path}.${req}`, message: 'required' });
    }
  }

  if (typeof e.hub === 'string' && !isSpecialistHubId(e.hub)) {
    issues.push({ path: `${path}.hub`, message: `invalid hub: ${e.hub}` });
  }

  if (typeof e.network_entity_id === 'string' && typeof e.hub === 'string') {
    try {
      const parsed = parseNetworkEntityId(e.network_entity_id);
      if (parsed.hub !== e.hub) {
        issues.push({
          path: `${path}.network_entity_id`,
          message: `hub mismatch: id=${parsed.hub} field=${e.hub}`,
        });
      }
      if (parsed.sourceEntityId !== e.source_entity_id) {
        issues.push({
          path: `${path}.network_entity_id`,
          message: 'source_entity_id must match network_entity_id suffix',
        });
      }
    } catch (err) {
      issues.push({
        path: `${path}.network_entity_id`,
        message: err instanceof Error ? err.message : 'invalid network id',
      });
    }
  }

  if (typeof e.canonical_profile_url === 'string') {
    try {
      const u = new URL(e.canonical_profile_url);
      if (u.protocol !== 'https:') {
        issues.push({ path: `${path}.canonical_profile_url`, message: 'must be https' });
      }
      if (typeof e.hub === 'string' && isSpecialistHubId(e.hub)) {
        const expected = new URL(CANONICAL_ORIGINS[e.hub]).hostname;
        if (u.hostname !== expected) {
          issues.push({
            path: `${path}.canonical_profile_url`,
            message: `host must be ${expected}, got ${u.hostname}`,
          });
        }
      } else if (!SPECIALIST_HOSTS.has(u.hostname)) {
        issues.push({
          path: `${path}.canonical_profile_url`,
          message: `unexpected host ${u.hostname}`,
        });
      }
    } catch {
      issues.push({ path: `${path}.canonical_profile_url`, message: 'malformed URL' });
    }
  }

  if (
    e.discovery_status !== undefined &&
    !['active', 'held', 'disabled'].includes(String(e.discovery_status))
  ) {
    issues.push({ path: `${path}.discovery_status`, message: 'invalid status' });
  }

  // Forbidden payload fields (thin-parent boundary)
  for (const bad of [
    'complaints',
    'trust_score',
    'documents',
    'email',
    'phone',
    'ssn',
    'consumer_notes',
    'paid_rank',
    'premium',
    'popularity',
    'raum',
  ]) {
    if (bad in e) {
      issues.push({ path: `${path}.${bad}`, message: 'forbidden field on discovery entity' });
    }
  }

  return issues;
}

export function validateDiscoveryCorpus(entities: unknown[]): {
  ok: boolean;
  issues: DiscoveryValidationIssue[];
} {
  const issues: DiscoveryValidationIssue[] = [];
  const ids = new Set<string>();
  entities.forEach((ent, i) => {
    const path = `entities[${i}]`;
    issues.push(...validateDiscoveryEntity(ent, path));
    const id = (ent as NetworkDiscoveryEntity)?.network_entity_id;
    if (typeof id === 'string') {
      if (ids.has(id)) {
        issues.push({ path: `${path}.network_entity_id`, message: `duplicate ${id}` });
      }
      ids.add(id);
    }
  });
  return { ok: issues.length === 0, issues };
}

export function isPreviewEligible(entity: NetworkDiscoveryEntity): boolean {
  const status = entity.discovery_status ?? 'active';
  return (
    status === 'active' &&
    !!entity.canonical_profile_url &&
    !!entity.display_name &&
    !!entity.network_entity_id
  );
}
