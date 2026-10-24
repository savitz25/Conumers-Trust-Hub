/**
 * ENB-001 — persisted accepted-extract baseline for the six specialist publications.
 *
 * The daily "Specialist network health" workflow already answers "is the upstream endpoint alive and
 * schema-compatible?" (scripts/verify-specialist-metrics.mjs) and "is the bundled fallback behind
 * upstream?" (scripts/refresh-specialist-fallbacks.mjs --check). What it could NOT answer was whether the
 * accepted extract itself changed, because the only persisted identity was the upstream-declared
 * `sourceFingerprint`, which moves whenever a specialist regenerates — including for clock-only rebuilds.
 *
 * This module derives, deterministically and without any network access, one baseline entry per hub that
 * separates:
 *   DATASET CONTENT IDENTITY  — contentHash over the canonical payload with every clock-valued key removed,
 *                               plus every metric's (key, grain, unit, value) at the publication's own grain,
 *                               the upstream contractRevision and the upstream sourceFingerprint; and
 *   RETRIEVAL / CLOCK METADATA — generatedAt, newest source as-of, every stripped clock leaf (as a hash),
 *                               and per-metric sourceAsOf.
 *
 * Nothing here mutates the accepted baseline. Comparison is pure; writing the accepted file is the CLI's
 * explicit `--replace --confirm=...` path only (scripts/accepted-extract-baseline.mjs), which is branch/PR
 * review material, never a scheduled or automatic write.
 */
import { createHash } from 'node:crypto';
import { SPECIALIST_OWNED_HUBS, SPECIALIST_SOURCES, type SpecialistHubId, type SpecialistSourceConfig } from './sources.ts';
import {
  validateContractorManifest,
  validateInsuranceManifest,
  validateInvestorManifest,
  validateLenderManifest,
  validateMoveManifest,
  validateSeniorManifest,
} from './validate.ts';

export const ACCEPTED_EXTRACT_BASELINE_SCHEMA = 'accepted-extract-baseline-v1';
/** Bump when the identity derivation below changes; hashes from a different parser version are not comparable. */
export const ACCEPTED_EXTRACT_PARSER_VERSION = 'ath-accepted-extract-parser-v1';
export const ACCEPTED_EXTRACT_BASELINE_REL_PATH = 'data/network-metrics/accepted-extract-baseline-v1.json';
export const ACCEPTED_EXTRACT_PROPOSAL_REL_PATH = 'data/network-metrics/accepted-extract-baseline-v1.proposal.json';
export const REPLACE_BASELINE_CONFIRMATION = 'REPLACE-ACCEPTED-EXTRACT-BASELINE';

export const DRIFT_CATEGORIES = [
  'NO_CHANGE',
  'CONTENT_HASH_CHANGED',
  'RECORD_COUNT_CHANGED',
  'SOURCE_CLOCK_CHANGED',
  'PARSER_VERSION_CHANGED',
  'SOURCE_IDENTITY_CHANGED',
  'SOURCE_MISSING',
  'BASELINE_MISSING',
  'UNKNOWN',
  /** Informational: upstream re-declared its fingerprint but the content identity is unchanged (clock-only rebuild). */
  'UPSTREAM_FINGERPRINT_CHANGED',
] as const;
export type DriftCategory = (typeof DRIFT_CATEGORIES)[number];

/** Highest severity first. A result's `primary` is the first of its categories in this order. */
const PRIMARY_ORDER: DriftCategory[] = [
  'SOURCE_MISSING',
  'BASELINE_MISSING',
  'UNKNOWN',
  'SOURCE_IDENTITY_CHANGED',
  'PARSER_VERSION_CHANGED',
  'RECORD_COUNT_CHANGED',
  'CONTENT_HASH_CHANGED',
  'SOURCE_CLOCK_CHANGED',
  'UPSTREAM_FINGERPRINT_CHANGED',
  'NO_CHANGE',
];
const CONTENT_DRIFT: ReadonlySet<DriftCategory> = new Set(['SOURCE_IDENTITY_CHANGED', 'PARSER_VERSION_CHANGED', 'RECORD_COUNT_CHANGED', 'CONTENT_HASH_CHANGED']);

export type AcceptedExtractMetric = { key: string; grain: string; unit: string | null; value: number | null };

export type AcceptedExtractContent = {
  contentHash: string;
  sourceFingerprint: string | null;
  contractRevision: string | null;
  metricCount: number;
  metrics: AcceptedExtractMetric[];
};

export type AcceptedExtractClocks = {
  generatedAt: string | null;
  newestSourceAsOf: string | null;
  /** sha256 over every stripped clock leaf (path → value), so clock-only change is detectable without storing them all. */
  clockHash: string;
  clockLeafCount: number;
  metricSourceAsOf: Array<{ key: string; sourceAsOf: string | null }>;
};

export type AcceptedExtractEntry = {
  hub: SpecialistHubId;
  acceptance: { state: 'ACCEPTED' | 'NOT_AVAILABLE'; acceptedFrom: string; acceptedAt: string; note: string | null };
  identity: { publicationUrl: string; schemaVersion: string };
  content: AcceptedExtractContent | null;
  clocks: AcceptedExtractClocks | null;
};

export type AcceptedExtractBaseline = {
  schemaVersion: typeof ACCEPTED_EXTRACT_BASELINE_SCHEMA;
  parserVersion: string;
  generatedAt: string;
  generatedFrom: string;
  entries: AcceptedExtractEntry[];
};

export type ExtractFetchResult = { ok: true; text: string } | { ok: false; reason: string };

export type CandidateEntry =
  | { hub: SpecialistHubId; available: true; entry: AcceptedExtractEntry }
  | { hub: SpecialistHubId; available: false; reason: string; identity: { publicationUrl: string; schemaVersion: string } };

export type EntryComparison = {
  hub: SpecialistHubId;
  primary: DriftCategory;
  categories: DriftCategory[];
  contentDrift: boolean;
  detail: Record<string, unknown>;
};

export type BaselineState = { state: 'PRESENT' } | { state: 'ABSENT' } | { state: 'MALFORMED'; reason: string };

export type OverallStatus = 'SAME' | 'DRIFT' | 'MISSING_BASELINE' | 'INCOMPLETE_BASELINE' | 'SOURCE_UNAVAILABLE';

export type BaselineReport = {
  schemaVersion: 'accepted-extract-baseline-report-v1';
  parserVersion: string;
  candidateFrom: string;
  checkedAt: string;
  baseline: BaselineState & { parserVersion?: string; generatedAt?: string };
  overall: OverallStatus;
  entries: EntryComparison[];
  counts: { total: number; sameContent: number; contentDrift: number; clockOnly: number; sourceMissing: number; baselineMissing: number; unknown: number };
};

export class MalformedBaselineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedBaselineError';
  }
}

const VALIDATORS: Record<SpecialistHubId, (raw: unknown) => Record<string, unknown>> = {
  contractor: validateContractorManifest,
  senior: validateSeniorManifest,
  move: validateMoveManifest,
  lender: validateLenderManifest,
  insurance: validateInsuranceManifest,
  investor: validateInvestorManifest,
};

// ---------------------------------------------------------------------------------------------------------
// Canonical JSON + hashing
// ---------------------------------------------------------------------------------------------------------

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * A key whose value is a date/timestamp/clock. Only string-or-null values are ever treated as clocks, so counters
 * that merely end in "Date" (e.g. `withRefreshDate: 1234`) stay in the content identity.
 */
export function isClockKey(key: string): boolean {
  return (
    /(?:At|AsOf|Date|Timestamp|Clock)$/.test(key) ||
    /(?:_at|_as_of|_date|_timestamp|_clock)$/.test(key) ||
    key === 'asOf' ||
    key === 'as_of'
  );
}

/** Keys that describe the upstream's own identity/versioning rather than dataset content; tracked separately. */
const IDENTITY_KEYS = new Set(['sourceFingerprint', 'contractRevision', 'schemaVersion']);

/** Walk the payload; return content (clock leaves removed) and the removed clock leaves keyed by path. */
export function splitContentAndClocks(payload: unknown): { content: unknown; clocks: Record<string, string | null> } {
  const clocks: Record<string, string | null> = {};
  const walk = (value: unknown, path: string, depth: number): unknown => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((item, index) => walk(item, `${path}[${index}]`, depth + 1));
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = (value as Record<string, unknown>)[key];
      const childPath = path ? `${path}.${key}` : key;
      if (depth === 0 && IDENTITY_KEYS.has(key)) continue;
      if (isClockKey(key) && (child === null || typeof child === 'string')) {
        clocks[childPath] = child;
        continue;
      }
      out[key] = walk(child, childPath, depth + 1);
    }
    return out;
  };
  return { content: walk(payload, '', 0), clocks };
}

function metricsOf(payload: Record<string, unknown>): AcceptedExtractMetric[] {
  const raw = Array.isArray(payload.metrics) ? (payload.metrics as Array<Record<string, unknown>>) : [];
  const metrics = raw
    .filter((item) => item && typeof item.key === 'string')
    .map((item) => ({
      key: String(item.key),
      grain: typeof item.grain === 'string' ? item.grain : '',
      unit: typeof item.unit === 'string' ? item.unit : null,
      value: typeof item.value === 'number' && Number.isFinite(item.value) ? item.value : null,
    }));
  metrics.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return metrics;
}

function metricClocksOf(payload: Record<string, unknown>): Array<{ key: string; sourceAsOf: string | null }> {
  const raw = Array.isArray(payload.metrics) ? (payload.metrics as Array<Record<string, unknown>>) : [];
  const rows = raw
    .filter((item) => item && typeof item.key === 'string')
    .map((item) => ({ key: String(item.key), sourceAsOf: typeof item.sourceAsOf === 'string' ? item.sourceAsOf : null }));
  rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return rows;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Derive one baseline entry from an already-validated specialist payload. Pure: the same payload always yields
 * the same entry bytes apart from `acceptance.acceptedAt`/`acceptedFrom`, which are supplied by the caller.
 */
export function buildAcceptedExtractEntry(
  hub: SpecialistHubId,
  payload: Record<string, unknown>,
  acceptance: { acceptedFrom: string; acceptedAt: string; note?: string | null },
  config: SpecialistSourceConfig = SPECIALIST_SOURCES[hub],
): AcceptedExtractEntry {
  const { content, clocks } = splitContentAndClocks(payload);
  const clockPaths = Object.keys(clocks).sort();
  return {
    hub,
    acceptance: { state: 'ACCEPTED', acceptedFrom: acceptance.acceptedFrom, acceptedAt: acceptance.acceptedAt, note: acceptance.note ?? null },
    identity: { publicationUrl: config.publicationUrl, schemaVersion: stringOrNull(payload.schemaVersion) ?? config.schemaVersion },
    content: {
      contentHash: sha256(canonicalJson(content)),
      sourceFingerprint: stringOrNull(payload.sourceFingerprint),
      contractRevision: stringOrNull(payload.contractRevision),
      metricCount: metricsOf(payload).length,
      metrics: metricsOf(payload),
    },
    clocks: {
      generatedAt: stringOrNull(payload.generatedAt),
      newestSourceAsOf: stringOrNull(payload.newestDocumentedSourceAsOf) ?? stringOrNull(payload.newestSourceAsOf),
      clockHash: sha256(canonicalJson(clockPaths.map((path) => [path, clocks[path]]))),
      clockLeafCount: clockPaths.length,
      metricSourceAsOf: metricClocksOf(payload),
    },
  };
}

/** An entry recording that no accepted extract was available locally. Never fabricates a hash or a zero count. */
export function notAvailableEntry(hub: SpecialistHubId, reason: string, acceptedAt: string, config: SpecialistSourceConfig = SPECIALIST_SOURCES[hub]): AcceptedExtractEntry {
  return {
    hub,
    acceptance: { state: 'NOT_AVAILABLE', acceptedFrom: 'none', acceptedAt, note: reason },
    identity: { publicationUrl: config.publicationUrl, schemaVersion: config.schemaVersion },
    content: null,
    clocks: null,
  };
}

/** Parse + validate a fetched/read payload into a candidate. Any failure is `available:false`, never a zero. */
export function buildCandidate(hub: SpecialistHubId, fetched: ExtractFetchResult, from: string, now: string, config: SpecialistSourceConfig = SPECIALIST_SOURCES[hub]): CandidateEntry {
  const identity = { publicationUrl: config.publicationUrl, schemaVersion: config.schemaVersion };
  if (!fetched.ok) return { hub, available: false, reason: fetched.reason, identity };
  let parsed: unknown;
  try {
    parsed = JSON.parse(fetched.text);
  } catch {
    return { hub, available: false, reason: 'payload was not valid JSON', identity };
  }
  try {
    VALIDATORS[hub](parsed);
  } catch (error) {
    return { hub, available: false, reason: `payload failed structural validation: ${(error as Error).message}`, identity };
  }
  return { hub, available: true, entry: buildAcceptedExtractEntry(hub, parsed as Record<string, unknown>, { acceptedFrom: from, acceptedAt: now }, config) };
}

// ---------------------------------------------------------------------------------------------------------
// Baseline document: deterministic serialization + strict parsing
// ---------------------------------------------------------------------------------------------------------

function sortedEntries(entries: AcceptedExtractEntry[]): AcceptedExtractEntry[] {
  return [...entries].sort((a, b) => (a.hub < b.hub ? -1 : a.hub > b.hub ? 1 : 0));
}

export function buildBaseline(entries: AcceptedExtractEntry[], meta: { generatedAt: string; generatedFrom: string }): AcceptedExtractBaseline {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.hub)) throw new Error(`duplicate baseline entry for hub ${entry.hub}`);
    seen.add(entry.hub);
  }
  return {
    schemaVersion: ACCEPTED_EXTRACT_BASELINE_SCHEMA,
    parserVersion: ACCEPTED_EXTRACT_PARSER_VERSION,
    generatedAt: meta.generatedAt,
    generatedFrom: meta.generatedFrom,
    entries: sortedEntries(entries).map(normalizeEntry),
  };
}

/** Fixed key order so the file diffs cleanly in git regardless of how the entry object was assembled. */
function normalizeEntry(entry: AcceptedExtractEntry): AcceptedExtractEntry {
  const metrics = entry.content ? [...entry.content.metrics].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)) : [];
  const metricSourceAsOf = entry.clocks ? [...entry.clocks.metricSourceAsOf].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)) : [];
  return {
    hub: entry.hub,
    acceptance: { state: entry.acceptance.state, acceptedFrom: entry.acceptance.acceptedFrom, acceptedAt: entry.acceptance.acceptedAt, note: entry.acceptance.note ?? null },
    identity: { publicationUrl: entry.identity.publicationUrl, schemaVersion: entry.identity.schemaVersion },
    content: entry.content
      ? {
          contentHash: entry.content.contentHash,
          sourceFingerprint: entry.content.sourceFingerprint,
          contractRevision: entry.content.contractRevision,
          metricCount: entry.content.metricCount,
          metrics: metrics.map((m) => ({ key: m.key, grain: m.grain, unit: m.unit, value: m.value })),
        }
      : null,
    clocks: entry.clocks
      ? {
          generatedAt: entry.clocks.generatedAt,
          newestSourceAsOf: entry.clocks.newestSourceAsOf,
          clockHash: entry.clocks.clockHash,
          clockLeafCount: entry.clocks.clockLeafCount,
          metricSourceAsOf: metricSourceAsOf.map((m) => ({ key: m.key, sourceAsOf: m.sourceAsOf })),
        }
      : null,
  };
}

export function serializeBaseline(baseline: AcceptedExtractBaseline): string {
  const normalized: AcceptedExtractBaseline = {
    schemaVersion: baseline.schemaVersion,
    parserVersion: baseline.parserVersion,
    generatedAt: baseline.generatedAt,
    generatedFrom: baseline.generatedFrom,
    entries: sortedEntries(baseline.entries).map(normalizeEntry),
  };
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const HUB_SET = new Set<string>(SPECIALIST_OWNED_HUBS);

export function parseBaseline(text: string): AcceptedExtractBaseline {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new MalformedBaselineError('baseline is not valid JSON');
  }
  if (!isRecord(raw)) throw new MalformedBaselineError('baseline must be an object');
  if (raw.schemaVersion !== ACCEPTED_EXTRACT_BASELINE_SCHEMA) throw new MalformedBaselineError(`unknown baseline schemaVersion: ${String(raw.schemaVersion)}`);
  if (typeof raw.parserVersion !== 'string' || raw.parserVersion.trim() === '') throw new MalformedBaselineError('baseline parserVersion required');
  if (typeof raw.generatedAt !== 'string' || !raw.generatedAt.includes('T')) throw new MalformedBaselineError('baseline generatedAt must be a timestamp');
  if (typeof raw.generatedFrom !== 'string') throw new MalformedBaselineError('baseline generatedFrom required');
  if (!Array.isArray(raw.entries)) throw new MalformedBaselineError('baseline entries must be an array');
  const seen = new Set<string>();
  const entries: AcceptedExtractEntry[] = raw.entries.map((item, index) => {
    if (!isRecord(item)) throw new MalformedBaselineError(`entry ${index} must be an object`);
    if (typeof item.hub !== 'string' || !HUB_SET.has(item.hub)) throw new MalformedBaselineError(`entry ${index}: unknown hub ${String(item.hub)}`);
    if (seen.has(item.hub)) throw new MalformedBaselineError(`duplicate entry for hub ${item.hub}`);
    seen.add(item.hub);
    const acceptance = item.acceptance;
    if (!isRecord(acceptance) || (acceptance.state !== 'ACCEPTED' && acceptance.state !== 'NOT_AVAILABLE')) throw new MalformedBaselineError(`${item.hub}: acceptance.state must be ACCEPTED or NOT_AVAILABLE`);
    if (typeof acceptance.acceptedFrom !== 'string' || typeof acceptance.acceptedAt !== 'string') throw new MalformedBaselineError(`${item.hub}: acceptance provenance required`);
    const identity = item.identity;
    if (!isRecord(identity) || typeof identity.publicationUrl !== 'string' || typeof identity.schemaVersion !== 'string') throw new MalformedBaselineError(`${item.hub}: identity required`);
    let content: AcceptedExtractContent | null = null;
    let clocks: AcceptedExtractClocks | null = null;
    if (acceptance.state === 'ACCEPTED') {
      const c = item.content;
      if (!isRecord(c) || typeof c.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(c.contentHash)) throw new MalformedBaselineError(`${item.hub}: accepted entry requires a sha256 contentHash`);
      if (typeof c.metricCount !== 'number' || !Array.isArray(c.metrics) || c.metrics.length !== c.metricCount) throw new MalformedBaselineError(`${item.hub}: metricCount must equal metrics.length`);
      for (const m of c.metrics as unknown[]) {
        if (!isRecord(m) || typeof m.key !== 'string' || typeof m.grain !== 'string' || (m.value !== null && typeof m.value !== 'number')) throw new MalformedBaselineError(`${item.hub}: malformed metric row`);
      }
      content = {
        contentHash: c.contentHash,
        sourceFingerprint: stringOrNull(c.sourceFingerprint),
        contractRevision: stringOrNull(c.contractRevision),
        metricCount: c.metricCount,
        metrics: (c.metrics as AcceptedExtractMetric[]).map((m) => ({ key: m.key, grain: m.grain, unit: m.unit ?? null, value: m.value })),
      };
      const k = item.clocks;
      if (!isRecord(k) || typeof k.clockHash !== 'string' || !Array.isArray(k.metricSourceAsOf)) throw new MalformedBaselineError(`${item.hub}: accepted entry requires clocks`);
      clocks = {
        generatedAt: stringOrNull(k.generatedAt),
        newestSourceAsOf: stringOrNull(k.newestSourceAsOf),
        clockHash: k.clockHash,
        clockLeafCount: typeof k.clockLeafCount === 'number' ? k.clockLeafCount : 0,
        metricSourceAsOf: (k.metricSourceAsOf as Array<{ key: string; sourceAsOf: string | null }>).map((m) => ({ key: m.key, sourceAsOf: m.sourceAsOf ?? null })),
      };
    } else if (item.content !== null && item.content !== undefined) {
      throw new MalformedBaselineError(`${item.hub}: NOT_AVAILABLE entry must not carry content`);
    }
    return {
      hub: item.hub as SpecialistHubId,
      acceptance: { state: acceptance.state, acceptedFrom: acceptance.acceptedFrom, acceptedAt: acceptance.acceptedAt, note: stringOrNull(acceptance.note) },
      identity: { publicationUrl: identity.publicationUrl, schemaVersion: identity.schemaVersion },
      content,
      clocks,
    };
  });
  return { schemaVersion: ACCEPTED_EXTRACT_BASELINE_SCHEMA, parserVersion: raw.parserVersion, generatedAt: raw.generatedAt, generatedFrom: raw.generatedFrom, entries: sortedEntries(entries) };
}

// ---------------------------------------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------------------------------------

function primaryOf(categories: DriftCategory[]): DriftCategory {
  for (const category of PRIMARY_ORDER) if (categories.includes(category)) return category;
  return 'UNKNOWN';
}

function finish(hub: SpecialistHubId, categories: DriftCategory[], detail: Record<string, unknown>): EntryComparison {
  const unique = [...new Set(categories)];
  const primary = primaryOf(unique);
  return { hub, primary, categories: unique.length ? unique : ['NO_CHANGE'], contentDrift: CONTENT_DRIFT.has(primary), detail };
}

/**
 * Compare one candidate against its accepted baseline entry. Never throws: anything unexpected is UNKNOWN.
 * `baselineParserVersion` is the parser version recorded in the baseline document.
 */
export function compareAcceptedExtract(baseline: AcceptedExtractEntry | undefined, candidate: CandidateEntry, baselineParserVersion: string = ACCEPTED_EXTRACT_PARSER_VERSION): EntryComparison {
  try {
    if (!candidate.available) {
      return finish(candidate.hub, ['SOURCE_MISSING'], { reason: candidate.reason, publicationUrl: candidate.identity.publicationUrl });
    }
    const current = candidate.entry;
    if (!baseline || baseline.acceptance.state !== 'ACCEPTED' || !baseline.content || !baseline.clocks) {
      return finish(candidate.hub, ['BASELINE_MISSING'], { reason: baseline ? `baseline entry is ${baseline.acceptance.state}: ${baseline.acceptance.note ?? 'no accepted extract'}` : 'no baseline entry for this hub' });
    }
    const categories: DriftCategory[] = [];
    const detail: Record<string, unknown> = {};
    if (baseline.identity.publicationUrl !== current.identity.publicationUrl || baseline.identity.schemaVersion !== current.identity.schemaVersion) {
      categories.push('SOURCE_IDENTITY_CHANGED');
      detail.identity = { baseline: baseline.identity, current: current.identity };
    }
    if (baselineParserVersion !== ACCEPTED_EXTRACT_PARSER_VERSION) {
      categories.push('PARSER_VERSION_CHANGED');
      detail.parserVersion = { baseline: baselineParserVersion, current: ACCEPTED_EXTRACT_PARSER_VERSION, note: 'hashes from different parser versions are not comparable; regenerate the baseline on a reviewed branch' };
      return finish(candidate.hub, categories, detail);
    }
    if (baseline.content.contractRevision !== current.content!.contractRevision) {
      categories.push('PARSER_VERSION_CHANGED');
      detail.contractRevision = { baseline: baseline.content.contractRevision, current: current.content!.contractRevision };
    }
    const countChanges = diffMetrics(baseline.content.metrics, current.content!.metrics);
    if (countChanges.length || baseline.content.metricCount !== current.content!.metricCount) {
      categories.push('RECORD_COUNT_CHANGED');
      detail.records = { baselineMetricCount: baseline.content.metricCount, currentMetricCount: current.content!.metricCount, changes: countChanges };
    }
    if (baseline.content.contentHash !== current.content!.contentHash) {
      categories.push('CONTENT_HASH_CHANGED');
      detail.contentHash = { baseline: baseline.content.contentHash, current: current.content!.contentHash };
    }
    if (baseline.clocks.clockHash !== current.clocks!.clockHash) {
      categories.push('SOURCE_CLOCK_CHANGED');
      detail.clocks = {
        generatedAt: { baseline: baseline.clocks.generatedAt, current: current.clocks!.generatedAt },
        newestSourceAsOf: { baseline: baseline.clocks.newestSourceAsOf, current: current.clocks!.newestSourceAsOf },
        metricSourceAsOfChanges: diffClocks(baseline.clocks.metricSourceAsOf, current.clocks!.metricSourceAsOf),
      };
    }
    if (baseline.content.sourceFingerprint !== current.content!.sourceFingerprint) {
      categories.push('UPSTREAM_FINGERPRINT_CHANGED');
      detail.sourceFingerprint = { baseline: baseline.content.sourceFingerprint, current: current.content!.sourceFingerprint };
    }
    if (!categories.length) categories.push('NO_CHANGE');
    return finish(candidate.hub, categories, detail);
  } catch (error) {
    return finish(candidate.hub, ['UNKNOWN'], { reason: (error as Error).message });
  }
}

function diffMetrics(before: AcceptedExtractMetric[], after: AcceptedExtractMetric[]): Array<{ key: string; change: 'added' | 'removed' | 'value' | 'grain'; from?: unknown; to?: unknown }> {
  const b = new Map(before.map((m) => [m.key, m]));
  const a = new Map(after.map((m) => [m.key, m]));
  const out: Array<{ key: string; change: 'added' | 'removed' | 'value' | 'grain'; from?: unknown; to?: unknown }> = [];
  for (const key of [...new Set([...b.keys(), ...a.keys()])].sort()) {
    const x = b.get(key);
    const y = a.get(key);
    if (!x) out.push({ key, change: 'added', to: y!.value });
    else if (!y) out.push({ key, change: 'removed', from: x.value });
    else if (x.grain !== y.grain) out.push({ key, change: 'grain', from: x.grain, to: y.grain });
    else if (x.value !== y.value) out.push({ key, change: 'value', from: x.value, to: y.value });
  }
  return out;
}

function diffClocks(before: Array<{ key: string; sourceAsOf: string | null }>, after: Array<{ key: string; sourceAsOf: string | null }>): Array<{ key: string; from: string | null; to: string | null }> {
  const b = new Map(before.map((m) => [m.key, m.sourceAsOf]));
  const out: Array<{ key: string; from: string | null; to: string | null }> = [];
  for (const row of after) {
    if (b.has(row.key) && b.get(row.key) !== row.sourceAsOf) out.push({ key: row.key, from: b.get(row.key) ?? null, to: row.sourceAsOf });
  }
  return out;
}

export function compareBaseline(
  baseline: { state: 'PRESENT'; document: AcceptedExtractBaseline } | { state: 'ABSENT' } | { state: 'MALFORMED'; reason: string },
  candidates: CandidateEntry[],
  meta: { candidateFrom: string; checkedAt: string },
): BaselineReport {
  const entries: EntryComparison[] = [...candidates]
    .sort((a, b) => (a.hub < b.hub ? -1 : a.hub > b.hub ? 1 : 0))
    .map((candidate) => {
      if (baseline.state === 'MALFORMED') return finish(candidate.hub, ['UNKNOWN'], { reason: `baseline malformed: ${baseline.reason}` });
      if (baseline.state === 'ABSENT') {
        if (!candidate.available) return finish(candidate.hub, ['SOURCE_MISSING'], { reason: candidate.reason });
        return finish(candidate.hub, ['BASELINE_MISSING'], { reason: 'no accepted baseline file' });
      }
      const entry = baseline.document.entries.find((item) => item.hub === candidate.hub);
      return compareAcceptedExtract(entry, candidate, baseline.document.parserVersion);
    });
  const counts = {
    total: entries.length,
    sameContent: entries.filter((e) => !e.contentDrift && !['SOURCE_MISSING', 'BASELINE_MISSING', 'UNKNOWN'].includes(e.primary)).length,
    contentDrift: entries.filter((e) => e.contentDrift).length,
    clockOnly: entries.filter((e) => e.primary === 'SOURCE_CLOCK_CHANGED').length,
    sourceMissing: entries.filter((e) => e.primary === 'SOURCE_MISSING').length,
    baselineMissing: entries.filter((e) => e.primary === 'BASELINE_MISSING').length,
    unknown: entries.filter((e) => e.primary === 'UNKNOWN').length,
  };
  let overall: OverallStatus;
  if (baseline.state !== 'PRESENT') overall = 'MISSING_BASELINE';
  else if (counts.contentDrift > 0) overall = 'DRIFT';
  else if (counts.baselineMissing > 0 || counts.unknown > 0) overall = 'INCOMPLETE_BASELINE';
  else if (counts.sourceMissing > 0) overall = 'SOURCE_UNAVAILABLE';
  else overall = 'SAME';
  const baselineState: BaselineReport['baseline'] =
    baseline.state === 'PRESENT'
      ? { state: 'PRESENT', parserVersion: baseline.document.parserVersion, generatedAt: baseline.document.generatedAt }
      : baseline.state === 'ABSENT'
        ? { state: 'ABSENT' }
        : { state: 'MALFORMED', reason: baseline.reason };
  return {
    schemaVersion: 'accepted-extract-baseline-report-v1',
    parserVersion: ACCEPTED_EXTRACT_PARSER_VERSION,
    candidateFrom: meta.candidateFrom,
    checkedAt: meta.checkedAt,
    baseline: baselineState,
    overall,
    entries,
    counts,
  };
}

export function formatReport(report: BaselineReport): string {
  const lines: string[] = [];
  lines.push(`accepted-extract baseline: ${report.overall} (candidates from ${report.candidateFrom}; baseline ${report.baseline.state}${report.baseline.state === 'MALFORMED' ? `: ${report.baseline.reason}` : ''})`);
  for (const entry of report.entries) {
    const extra = entry.categories.filter((c) => c !== entry.primary);
    let note = '';
    if (entry.primary === 'RECORD_COUNT_CHANGED') {
      const changes = (entry.detail.records as { changes: Array<{ key: string; change: string; from?: unknown; to?: unknown }> }).changes;
      note = ` ${changes.slice(0, 5).map((c) => `${c.key}:${c.change}${c.from !== undefined ? ` ${String(c.from)}` : ''}${c.to !== undefined ? `→${String(c.to)}` : ''}`).join(', ')}${changes.length > 5 ? ` …(+${changes.length - 5})` : ''}`;
    } else if (entry.primary === 'SOURCE_MISSING' || entry.primary === 'BASELINE_MISSING' || entry.primary === 'UNKNOWN') {
      note = ` ${String(entry.detail.reason ?? '')}`;
    } else if (entry.primary === 'PARSER_VERSION_CHANGED') {
      const rev = entry.detail.contractRevision as { baseline: string | null; current: string | null } | undefined;
      const parser = entry.detail.parserVersion as { baseline: string; current: string } | undefined;
      note = rev ? ` contractRevision ${rev.baseline ?? 'unknown'}→${rev.current ?? 'unknown'}` : parser ? ` baseline parser ${parser.baseline} vs ${parser.current}` : '';
    } else if (entry.primary === 'SOURCE_CLOCK_CHANGED') {
      const clocks = entry.detail.clocks as { generatedAt: { baseline: string | null; current: string | null } };
      note = ` generatedAt ${clocks.generatedAt.baseline ?? 'null'}→${clocks.generatedAt.current ?? 'null'} (content identity unchanged)`;
    }
    lines.push(`  [${entry.hub}] ${entry.primary}${extra.length ? ` (+${extra.join(', ')})` : ''}${note}`);
  }
  const c = report.counts;
  lines.push(`  content same: ${c.sameContent} · content drift: ${c.contentDrift} · clock-only: ${c.clockOnly} · source missing: ${c.sourceMissing} · baseline missing: ${c.baselineMissing} · unknown: ${c.unknown}`);
  return lines.join('\n');
}
