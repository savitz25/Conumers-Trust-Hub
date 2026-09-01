import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const HUB_IDS = ['move', 'lender', 'insurance', 'senior', 'contractor', 'investor'] as const;
export type HubId = (typeof HUB_IDS)[number];

export type CountRecord = {
  metric_id: string;
  label: string;
  value: number;
  grain: string;
  scope: string;
  public_or_internal: 'public' | 'internal';
  source_contract: string;
  source_family: string;
  as_of_date: string | null;
  retrieved_at: string;
  additive_group: string | null;
  limitation: string;
};

export type HubManifest = {
  hub_id: HubId;
  hub_name: string;
  canonical_url: string;
  repository: string;
  source_main_sha: string;
  production_sha: string | null;
  contract_version: string;
  contract_generated_at: string;
  entity_classes: Array<{ id: string; label: string; publication_status: string }>;
  entity_counts: CountRecord[];
  public_profile_counts: Array<{ metric_id: string; value: number; grain: string }>;
  evidence_families: Array<{ family: string; subtype: string }>;
  evidence_counts: CountRecord[];
  relationship_families: string[];
  geography_capabilities: Array<{ level: string; meaning: string }>;
  enhanced_geographies: Array<{ jurisdiction: string; level: string; evidence_families: string[]; routes: string[] }>;
  source_families: string[];
  source_clocks: Array<{ source_family: string; as_of_date: string | null; retrieved_at: string }>;
  research_routes: Array<{ question: string; route: string }>;
  publication_notes: string[];
  limitations: string[];
  consumer_research_questions: string[];
};

const DATA_DIR = join(process.cwd(), 'data', 'network-intelligence');

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function fingerprint(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function readArtifact<T>(file: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')) as T;
}

export function loadHubManifests(): HubManifest[] {
  return HUB_IDS.map((id) => readArtifact<HubManifest>(`${id}.json`));
}

function requireText(value: unknown, message: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(message);
}

export function validateHubManifest(manifest: HubManifest): void {
  if (!HUB_IDS.includes(manifest.hub_id)) throw new Error(`Unknown hub: ${manifest.hub_id}`);
  requireText(manifest.canonical_url, `${manifest.hub_id}: canonical URL required`);
  requireText(manifest.source_main_sha, `${manifest.hub_id}: source SHA required`);
  if (!/^[a-f0-9]{40}$/.test(manifest.source_main_sha)) throw new Error(`${manifest.hub_id}: invalid source SHA`);
  const ids = new Set<string>();
  for (const metric of [...manifest.entity_counts, ...manifest.evidence_counts]) {
    if (ids.has(metric.metric_id)) throw new Error(`${manifest.hub_id}: duplicate metric ${metric.metric_id}`);
    ids.add(metric.metric_id);
    requireText(metric.grain, `${metric.metric_id}: grain required`);
    requireText(metric.source_contract, `${metric.metric_id}: source contract required`);
    requireText(metric.source_family, `${metric.metric_id}: source family required`);
    requireText(metric.retrieved_at, `${metric.metric_id}: retrieval clock required`);
    requireText(metric.limitation, `${metric.metric_id}: limitation required`);
  }
  for (const geography of manifest.enhanced_geographies) {
    if (!geography.evidence_families.length || !geography.routes.length) throw new Error(`${manifest.hub_id}: enhanced geography requires evidence and route`);
  }
  const serialized = JSON.stringify(manifest).toLowerCase();
  if (serialized.includes('universal_trust_score') || serialized.includes('paid_ranking')) throw new Error(`${manifest.hub_id}: forbidden field`);
}

export function validateNetwork(): { manifests: HubManifest[]; fingerprints: Record<string, string> } {
  const manifests = loadHubManifests();
  if (manifests.length !== 6 || new Set(manifests.map((item) => item.hub_id)).size !== 6) throw new Error('Exactly six unique hubs required');
  manifests.forEach(validateHubManifest);
  const contract = readArtifact<Record<string, unknown>>('ask-network-intel-v1.json');
  const coverage = readArtifact<Record<string, unknown>>('network-coverage-v1.json');
  const ledger = readArtifact<Record<string, unknown>>('network-source-ledger-v1.json');
  const assessments = contract.aggregate_assessments as Array<{ classification: string }>;
  if ((contract.safe_aggregate_metrics as unknown[]).length !== 0) throw new Error('No current safe cross-hub aggregate is authorized');
  if (assessments.some((item) => item.classification === 'SAFE_TO_SUM')) throw new Error('SAFE_TO_SUM requires an explicit compatible additive group');
  return { manifests, fingerprints: Object.fromEntries([...manifests.map((item) => [item.hub_id, fingerprint(item)]), ['network-coverage-v1', fingerprint(coverage)], ['network-source-ledger-v1', fingerprint(ledger)], ['ask-network-intel-v1', fingerprint(contract)]]) };
}
