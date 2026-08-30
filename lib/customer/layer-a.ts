/**
 * Evidence firewall: Ask customer flows must never mutate Contractor Layer A.
 */

export const LAYER_A_TABLES = [
  'licenses',
  'discipline_actions',
  'regulatory_source_observations',
  'regulatory_source_occurrences',
  'contractors',
  'trust_scores',
] as const;

export const FORBIDDEN_CTH_WRITE_PATTERNS = [
  /^\s*(insert|update|delete|truncate|alter|drop)\b/i,
];

export function assertReadOnlyCthSql(sql: string): void {
  const trimmed = sql.trim();
  for (const pat of FORBIDDEN_CTH_WRITE_PATTERNS) {
    if (pat.test(trimmed)) {
      throw new Error('evidence_firewall: Contractor Layer A writes are forbidden');
    }
  }
}

export type LayerAFingerprint = {
  licenses: string;
  discipline: string;
  observations: string;
  publicationEligible: string;
  contractorsUpdated: string;
};

export const LAYER_A_FINGERPRINT_SQL = `
SELECT
  (SELECT COUNT(*)::text FROM licenses WHERE source_system = 'fl_dbpr') AS licenses,
  (SELECT COUNT(*)::text FROM discipline_actions WHERE source_system = 'fl_dbpr') AS discipline,
  (SELECT COALESCE(MAX(updated_at)::text, 'none') FROM discipline_actions WHERE source_system = 'fl_dbpr') AS discipline_updated,
  (SELECT COUNT(*)::text FROM regulatory_source_observations) AS observations,
  (SELECT COUNT(*)::text FROM discipline_actions
     WHERE source_system = 'fl_dbpr' AND publication_state = 'PUBLIC_ELIGIBLE') AS publication_eligible,
  (SELECT COALESCE(MAX(updated_at)::text, 'none') FROM contractors) AS contractors_updated
`;

export function fingerprintsMatch(a: LayerAFingerprint, b: LayerAFingerprint): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
