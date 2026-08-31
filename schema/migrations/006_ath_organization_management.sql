-- ATH-CUST-009: private organization invitations and team-management controls.

CREATE TABLE IF NOT EXISTS ath_organization_invitations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID NOT NULL REFERENCES ath_organizations(id) ON DELETE RESTRICT,
  invited_email_normalized TEXT NOT NULL,
  invited_role             TEXT NOT NULL CHECK (invited_role IN ('manager','staff','billing')),
  invited_by_user_id       UUID NOT NULL REFERENCES ath_users(id) ON DELETE RESTRICT,
  status                   TEXT NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING','ACCEPTED','REVOKED','EXPIRED')),
  token_hash               TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at               TIMESTAMPTZ NOT NULL,
  accepted_by_user_id      UUID REFERENCES ath_users(id) ON DELETE RESTRICT,
  accepted_at              TIMESTAMPTZ,
  revoked_at               TIMESTAMPTZ,
  version                  INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status = 'ACCEPTED') = (accepted_by_user_id IS NOT NULL AND accepted_at IS NOT NULL)),
  CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ath_organization_invitations_pending_email
  ON ath_organization_invitations(org_id, invited_email_normalized)
  WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS ath_organization_invitations_org_created
  ON ath_organization_invitations(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ath_organization_invitations_expiry
  ON ath_organization_invitations(expires_at)
  WHERE status = 'PENDING';

ALTER TABLE ath_organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ath_organization_invitations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ath_server_all ON ath_organization_invitations;
CREATE POLICY ath_server_all ON ath_organization_invitations
  USING (ath_is_server()) WITH CHECK (ath_is_server());

COMMENT ON TABLE ath_organization_invitations IS
  'Private, hashed, expiring organization invitations that never grant profile authority by themselves.';
