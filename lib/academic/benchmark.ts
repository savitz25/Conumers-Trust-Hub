/**
 * TrustHub Entity Resolution Benchmark — specification only.
 * No production matching data, synthetic scores, or claimed results.
 */

export const ENTITY_RESOLUTION_BENCHMARK_ID = 'trusthub-entity-resolution-benchmark';

export const ENTITY_RESOLUTION_BENCHMARK_TITLE = 'TrustHub Entity Resolution Benchmark';

export const ENTITY_RESOLUTION_BENCHMARK_STATUS =
  'Documentation and internal unlabeled candidates (Academic 001C.1). No public ground-truth file, no claimed precision/recall, no production matching dump.';

export const ENTITY_RESOLUTION_EXAMPLE_CLASSES = [
  'Legal name versus DBA',
  'Same entity, different location strings',
  'Company rename / successor-predecessor',
  'Duplicated regulatory records',
  'Corporate-family members that should not collapse',
  'Ambiguous near-matches',
  'False-positive traps (similar names, unrelated firms)',
] as const;

export const ENTITY_RESOLUTION_FUTURE_METRICS = [
  'Precision',
  'Recall',
  'False-positive rate',
  'False-negative rate',
  'Confidence calibration',
] as const;

export const ENTITY_RESOLUTION_GUARDRAILS = [
  'Do not expose production matcher internals or unpublished confidence scores as research results.',
  'Hand-reviewed labels, when they exist, should be versioned like any other academic snapshot.',
  'Consumer PII is out of scope. Ground truth concerns business identity in public registries.',
  'Do not generate synthetic performance claims to fill the catalog.',
] as const;
