import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCES = [
  {
    hub: 'move',
    schemaVersion: 'move-network-metrics-v1',
    url: 'https://raw.githubusercontent.com/savitz25/Move-trust-Hub/main/data/home/move-network-metrics-v1.json',
    fallback: 'data/network-metrics/move-v1-fallback.json',
    fingerprint: '0b88bf6a0e0a906505c9148fe6d9e2c88ae568e024b852929a2660ed8b867a11',
    required: ['federal_publishable_directory_profiles', 'florida_fdacs_im_active_registrations'],
  },
  {
    hub: 'lender',
    schemaVersion: 'lender-network-metrics-v1',
    url: 'https://raw.githubusercontent.com/savitz25/Lender-Trust-Hub/main/data/home/lender-network-metrics-v1.json',
    fallback: 'data/network-metrics/lender-v1-fallback.json',
    fingerprint: '6bd624717bb1bd1ddd4880d40adccbafeba58d6624e069971f728875d750587a',
    required: ['lenders_lending_institutions', 'hmda_2025_county_applications'],
  },
  {
    hub: 'insurance',
    schemaVersion: 'insurance-network-metrics-v1',
    url: 'https://raw.githubusercontent.com/savitz25/Insurance-trust-hub/main/data/home/insurance-network-metrics-v1.json',
    fallback: 'data/network-metrics/insurance-v1-fallback.json',
    fingerprint: 'c9120eaf14f96cc8226c5ac8f7e5dc940c328b339bcb75ebc1596bc306d6f301',
    required: ['insurance_agencies', 'cms_marketplace_evidence_observations'],
  },
  {
    hub: 'contractor',
    schemaVersion: 'contractor-network-metrics-v1',
    url: 'https://raw.githubusercontent.com/savitz25/contractor-trust-hub/main/data/home/contractor-network-metrics-v1.json',
    fallback: 'data/network-metrics/contractor-v1-fallback.json',
    fingerprint: '0a99e8a1cf53590d01506d57072f4a320aa6c0060476a779193d8af1dd8034b3',
    required: ['live_credential_records', 'nj_construction_source_records'],
  },
  {
    hub: 'senior',
    schemaVersion: 'senior-network-metrics-v1',
    url: 'https://raw.githubusercontent.com/savitz25/care-trust-hub/main/apps/web/src/data/senior-network-metrics-v1.json',
    fallback: 'data/network-metrics/senior-v1-fallback.json',
    fingerprint: '36a042ec89322dd9b7d91440221928a4f617f9761f275bae22491f97d476a84e',
    required: ['current_nursing_homes', 'mds_observations'],
  },
];

function metricKeys(raw) {
  return new Set((raw.metrics ?? []).map((item) => item.key));
}

const errors = [];
for (const source of SOURCES) {
  const fallback = JSON.parse(readFileSync(join(process.cwd(), source.fallback), 'utf8'));
  const response = await fetch(source.url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    errors.push(`${source.hub}: upstream ${response.status}`);
    continue;
  }
  const upstream = await response.json();
  if (upstream.schemaVersion !== source.schemaVersion || fallback.schemaVersion !== source.schemaVersion) {
    errors.push(`${source.hub}: schemaVersion mismatch`);
  }
  if (upstream.sourceFingerprint !== source.fingerprint) {
    errors.push(`${source.hub}: upstream fingerprint ${upstream.sourceFingerprint} != accepted ${source.fingerprint}`);
  }
  if (fallback.sourceFingerprint !== source.fingerprint) {
    errors.push(`${source.hub}: fallback fingerprint ${fallback.sourceFingerprint} != accepted ${source.fingerprint}`);
  }
  const keys = metricKeys(upstream);
  for (const key of source.required) {
    if (!keys.has(key)) errors.push(`${source.hub}: missing ${key}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('specialist fallback fingerprints match accepted upstream manifests');
