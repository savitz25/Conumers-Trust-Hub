import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCES = [
  {
    hub: 'move',
    schemaVersion: 'move-network-metrics-v1',
    url: 'https://raw.githubusercontent.com/savitz25/Move-trust-Hub/main/data/home/move-network-metrics-v1.json',
    fallback: 'data/network-metrics/move-v1-fallback.json',
    required: ['federal_publishable_directory_profiles', 'florida_fdacs_im_active_registrations'],
  },
  {
    hub: 'lender',
    schemaVersion: 'lender-network-metrics-v1',
    url: 'https://raw.githubusercontent.com/savitz25/Lender-Trust-Hub/main/data/home/lender-network-metrics-v1.json',
    fallback: 'data/network-metrics/lender-v1-fallback.json',
    required: ['lenders_lending_institutions', 'hmda_2025_county_applications'],
  },
  {
    hub: 'insurance',
    schemaVersion: 'insurance-network-metrics-v1',
    url: 'https://raw.githubusercontent.com/savitz25/Insurance-trust-hub/main/data/home/insurance-network-metrics-v1.json',
    fallback: 'data/network-metrics/insurance-v1-fallback.json',
    required: ['insurance_agencies', 'cms_marketplace_evidence_observations'],
  },
  {
    hub: 'contractor',
    schemaVersion: 'contractor-network-metrics-v1',
    url: 'https://raw.githubusercontent.com/savitz25/contractor-trust-hub/main/data/home/contractor-network-metrics-v1.json',
    fallback: 'data/network-metrics/contractor-v1-fallback.json',
    required: ['live_credential_records', 'nj_construction_source_records'],
  },
  {
    hub: 'senior',
    schemaVersion: 'senior-network-metrics-v1',
    url: 'https://raw.githubusercontent.com/savitz25/care-trust-hub/main/apps/web/src/data/senior-network-metrics-v1.json',
    fallback: 'data/network-metrics/senior-v1-fallback.json',
    required: ['current_nursing_homes', 'mds_observations'],
  },
  {
    hub: 'investor',
    schemaVersion: 'investor-network-metrics-v1',
    url: 'https://raw.githubusercontent.com/savitz25/investor-trust-hub/main/data/home/investor-network-metrics-v1.json',
    fallback: 'data/network-metrics/investor-v1-fallback.json',
    required: ['investment_advisory_firms', 'form_adv_attribute_observations'],
  },
];

function metricKeys(raw) {
  return new Set((raw.metrics ?? []).map((item) => item.key));
}

// This check is a schema/staleness safety net, not a revision pin. A new upstream
// sourceFingerprint/contractRevision is expected and healthy whenever a specialist
// ships a compatible metrics update; it must never fail this check by itself. What
// DOES fail closed: the upstream no longer matching its documented schema family,
// or dropping a required field AskTrustHub depends on. Fingerprint drift between
// upstream and our bundled fallback is logged as an informational reminder to
// refresh the fallback snapshot (data/network-metrics/<hub>-v1-fallback.json),
// which keeps fallback data from going stale over many specialist releases.
const errors = [];
const notices = [];
for (const source of SOURCES) {
  const fallback = JSON.parse(readFileSync(join(process.cwd(), source.fallback), 'utf8'));
  const response = await fetch(source.url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    errors.push(`${source.hub}: upstream ${response.status}`);
    continue;
  }
  const upstream = await response.json();
  if (upstream.schemaVersion !== source.schemaVersion) {
    errors.push(`${source.hub}: upstream schemaVersion mismatch (${upstream.schemaVersion})`);
  }
  if (fallback.schemaVersion !== source.schemaVersion) {
    errors.push(`${source.hub}: bundled fallback schemaVersion mismatch (${fallback.schemaVersion})`);
  }
  const keys = metricKeys(upstream);
  for (const key of source.required) {
    if (!keys.has(key)) errors.push(`${source.hub}: upstream missing required metric ${key}`);
  }
  const fallbackKeys = metricKeys(fallback);
  for (const key of source.required) {
    if (!fallbackKeys.has(key)) errors.push(`${source.hub}: bundled fallback missing required metric ${key}`);
  }
  if (upstream.sourceFingerprint !== fallback.sourceFingerprint) {
    notices.push(
      `${source.hub}: upstream contractRevision ${upstream.contractRevision ?? 'unknown'} (fingerprint ${upstream.sourceFingerprint}) ` +
      `differs from bundled fallback contractRevision ${fallback.contractRevision ?? 'unknown'} (fingerprint ${fallback.sourceFingerprint}). ` +
      'This is expected when a specialist ships a new compatible release; consider refreshing the bundled fallback.',
    );
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
if (notices.length) console.log(notices.join('\n'));
console.log('specialist upstream and bundled fallback manifests are schema-compatible');
