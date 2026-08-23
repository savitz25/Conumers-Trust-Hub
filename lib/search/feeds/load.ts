import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SearchHubId } from '../types';
import type { NetworkDiscoveryEntity } from '../discovery/types';
import { projectStandardEntity } from './project';
import { envelopeFingerprint, validateRealFeedEntities } from './validate';
import type { FeedProvenance, LoadedFeed } from './types';

export function loadProvenance(rootDir = process.cwd()): Record<string, FeedProvenance> {
  const path = join(rootDir, 'data/network-discovery/feeds/provenance.json');
  const raw = JSON.parse(readFileSync(path, 'utf8')) as {
    feeds: Record<string, FeedProvenance>;
  };
  return raw.feeds;
}

export function loadSpecialistFeed(hub: SearchHubId, rootDir = process.cwd()): LoadedFeed {
  const provenance = loadProvenance(rootDir)[hub];
  if (!provenance) {
    return {
      hub,
      status: 'failed',
      provenance: {
        hub,
        local_path: '',
        source_repository: '',
        source_sha: '',
        source_artifact: '',
        entity_count: 0,
        fingerprint: '',
      },
      entity_count: 0,
      fingerprint: '',
      entities: [],
      issues: [{ path: 'provenance', message: `no provenance for ${hub}` }],
    };
  }

  const abs = join(rootDir, provenance.local_path);
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(readFileSync(abs, 'utf8')) as Record<string, unknown>;
  } catch (err) {
    return {
      hub,
      status: 'failed',
      provenance,
      entity_count: 0,
      fingerprint: '',
      entities: [],
      issues: [{ path: abs, message: err instanceof Error ? err.message : 'read failed' }],
    };
  }

  const issues: LoadedFeed['issues'] = [];
  if (raw.schema_version !== 'ask-network-discovery-v1') {
    issues.push({ path: 'schema_version', message: `got ${String(raw.schema_version)}` });
  }
  if (raw.hub !== hub) {
    issues.push({ path: 'hub', message: `expected ${hub} got ${String(raw.hub)}` });
  }
  const fp = envelopeFingerprint(raw);
  if (!fp || fp !== provenance.fingerprint) {
    issues.push({
      path: 'fingerprint',
      message: `expected ${provenance.fingerprint} got ${fp || 'missing'}`,
    });
  }
  const count = Number(raw.entity_count);
  if (count !== provenance.entity_count) {
    issues.push({
      path: 'entity_count',
      message: `expected ${provenance.entity_count} got ${count}`,
    });
  }
  const list = Array.isArray(raw.entities) ? (raw.entities as Record<string, unknown>[]) : [];
  if (list.length !== provenance.entity_count) {
    issues.push({
      path: 'entities.length',
      message: `expected ${provenance.entity_count} got ${list.length}`,
    });
  }

  if (issues.length) {
    return {
      hub,
      status: 'failed',
      provenance,
      entity_count: list.length,
      fingerprint: fp || '',
      entities: [],
      issues,
    };
  }

  const projected: NetworkDiscoveryEntity[] = [];
  list.forEach((row, i) => {
    const ent = projectStandardEntity(row, hub);
    if (!ent) {
      issues.push({ path: `entities[${i}]`, message: 'projection failed' });
      return;
    }
    projected.push(ent);
  });

  if (issues.length) {
    return { hub, status: 'failed', provenance, entity_count: list.length, fingerprint: fp || '', entities: [], issues };
  }

  const v = validateRealFeedEntities(projected, hub);
  if (!v.ok) {
    return {
      hub,
      status: 'failed',
      provenance,
      entity_count: projected.length,
      fingerprint: fp || '',
      entities: [],
      issues: v.issues,
    };
  }

  return {
    hub,
    status: 'ok',
    provenance,
    entity_count: projected.length,
    fingerprint: fp || '',
    entities: projected,
    issues: [],
  };
}
