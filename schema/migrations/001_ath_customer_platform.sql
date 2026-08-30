-- ATH-CUST-002 — AskTrustHub business customer data plane
-- Ask-owned Postgres only. Never apply to ContractorTrustHub evidence DB.
-- Idempotent. Reversal: schema/migrations/001_ath_customer_platform.down.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ath_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION ath_forbid_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ath_audit_events is append-only';
END;
$$;

-- Server-only gate: FORCE RLS so even the table owner must set ath.app_role.
-- The Ask process sets SET LOCAL ath.app_role = 'server' inside a transaction.

CREATE OR REPLACE FUNCTION ath_is_server()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_setting('ath.app_role', true) = 'server';
$$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ath_users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL,
  email_normalized    TEXT NOT NULL,
  email_confirmed_at  TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'active', 'suspended')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ath_users_email_normalized_unique UNIQUE (email_normalized)
);

DROP TRIGGER IF EXISTS ath_users_updated_at ON ath_users;
CREATE TRIGGER ath_users_updated_at
  BEFORE UPDATE ON ath_users
  FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();

CREATE TABLE IF NOT EXISTS ath_auth_challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized TEXT NOT NULL,
  user_id         UUID REFERENCES ath_users (id) ON DELETE SET NULL,
  purpose         TEXT NOT NULL
                    CHECK (purpose IN ('login', 'confirm_email', 'claim_continue')),
  token_hash      TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  attempt_count   INTEGER NOT NULL DEFAULT 0,
  request_ip      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ath_auth_challenges_email_created_idx
  ON ath_auth_challenges (email_normalized, created_at DESC);

CREATE TABLE IF NOT EXISTS ath_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES ath_users (id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  claim_intent_id UUID,
  ip              TEXT,
  user_agent      TEXT
);

CREATE INDEX IF NOT EXISTS ath_sessions_user_idx ON ath_sessions (user_id);

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ath_organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name    TEXT NOT NULL,
  legal_name      TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS ath_organizations_updated_at ON ath_organizations;
CREATE TRIGGER ath_organizations_updated_at
  BEFORE UPDATE ON ath_organizations
  FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();

CREATE TABLE IF NOT EXISTS ath_memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES ath_organizations (id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES ath_users (id) ON DELETE CASCADE,
  role            TEXT NOT NULL
                    CHECK (role IN ('owner', 'manager', 'staff', 'billing')),
  status          TEXT NOT NULL DEFAULT 'invited'
                    CHECK (status IN ('invited', 'active', 'revoked')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS ath_memberships_updated_at ON ath_memberships;
CREATE TRIGGER ath_memberships_updated_at
  BEFORE UPDATE ON ath_memberships
  FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS ath_memberships_active_user_org
  ON ath_memberships (org_id, user_id)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- Hub profile pointers (Florida Contractor only in ATH-CUST-002)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ath_hub_profiles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id                  TEXT NOT NULL CHECK (hub_id = 'contractor'),
  native_profile_id       UUID NOT NULL,
  native_slug             TEXT NOT NULL,
  native_credential_key   TEXT NOT NULL,
  native_source_system    TEXT NOT NULL CHECK (native_source_system = 'fl_dbpr'),
  home_state              CHAR(2) NOT NULL CHECK (home_state = 'FL'),
  display_name_snapshot   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_validated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ath_hub_profiles_native_unique UNIQUE (hub_id, native_profile_id)
);

-- ---------------------------------------------------------------------------
-- Claims (historical; never a boolean on the profile)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ath_claims (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES ath_organizations (id) ON DELETE RESTRICT,
  hub_profile_id        UUID NOT NULL REFERENCES ath_hub_profiles (id) ON DELETE RESTRICT,
  claimant_user_id      UUID NOT NULL REFERENCES ath_users (id) ON DELETE RESTRICT,
  status                TEXT NOT NULL
                          CHECK (status IN (
                            'submitted', 'needs_info', 'in_review',
                            'approved', 'rejected', 'withdrawn', 'superseded'
                          )),
  verification_method   TEXT NOT NULL
                          CHECK (verification_method IN (
                            'official_license_match', 'domain_email',
                            'document_upload', 'manual_review', 'other'
                          )),
  relationship_type     TEXT NOT NULL
                          CHECK (relationship_type IN (
                            'owner', 'officer', 'qualifying_agent',
                            'authorized_manager', 'employee',
                            'third_party_representative'
                          )),
  free_email            BOOLEAN NOT NULL,
  attestation           JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at           TIMESTAMPTZ,
  reviewed_by           UUID REFERENCES ath_users (id) ON DELETE SET NULL,
  decision_reason       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS ath_claims_updated_at ON ath_claims;
CREATE TRIGGER ath_claims_updated_at
  BEFORE UPDATE ON ath_claims
  FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();

CREATE INDEX IF NOT EXISTS ath_claims_hub_status_idx
  ON ath_claims (hub_profile_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ath_claims_org_idx ON ath_claims (org_id);
CREATE INDEX IF NOT EXISTS ath_claims_claimant_idx ON ath_claims (claimant_user_id);

-- ---------------------------------------------------------------------------
-- Management grants — the actual authorization object
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ath_management_grants (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES ath_organizations (id) ON DELETE RESTRICT,
  hub_profile_id          UUID NOT NULL REFERENCES ath_hub_profiles (id) ON DELETE RESTRICT,
  status                  TEXT NOT NULL
                            CHECK (status IN ('active', 'revoked', 'contested')),
  granted_from_claim_id   UUID NOT NULL REFERENCES ath_claims (id) ON DELETE RESTRICT,
  granted_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by              UUID REFERENCES ath_users (id) ON DELETE SET NULL,
  revoked_at              TIMESTAMPTZ,
  revoked_by              UUID REFERENCES ath_users (id) ON DELETE SET NULL,
  revocation_reason       TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ath_management_grants_one_active
  ON ath_management_grants (hub_profile_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS ath_management_grants_org_idx
  ON ath_management_grants (org_id);

-- ---------------------------------------------------------------------------
-- Review queue
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ath_review_queue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_type         TEXT NOT NULL
                      CHECK (work_type IN ('claim_review', 'competing_claim', 'record_issue')),
  object_type       TEXT NOT NULL,
  object_id         UUID NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'in_progress', 'resolved', 'cancelled')),
  risk_state        TEXT NOT NULL DEFAULT 'standard'
                      CHECK (risk_state IN ('standard', 'free_email', 'competing', 'elevated')),
  assigned_reviewer UUID REFERENCES ath_users (id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ath_review_queue_open_idx
  ON ath_review_queue (status, created_at DESC)
  WHERE status IN ('open', 'in_progress');

-- ---------------------------------------------------------------------------
-- Audit (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ath_audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   UUID REFERENCES ath_users (id) ON DELETE SET NULL,
  actor_kind      TEXT NOT NULL DEFAULT 'user'
                    CHECK (actor_kind IN ('user', 'staff', 'system')),
  org_id          UUID REFERENCES ath_organizations (id) ON DELETE SET NULL,
  object_type     TEXT NOT NULL,
  object_id       UUID,
  action          TEXT NOT NULL,
  before_state    JSONB,
  after_state     JSONB,
  ip              TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ath_audit_events_object_idx
  ON ath_audit_events (object_type, object_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ath_audit_events_org_idx
  ON ath_audit_events (org_id, created_at DESC);

DROP TRIGGER IF EXISTS ath_audit_events_no_update ON ath_audit_events;
CREATE TRIGGER ath_audit_events_no_update
  BEFORE UPDATE ON ath_audit_events
  FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();

DROP TRIGGER IF EXISTS ath_audit_events_no_delete ON ath_audit_events;
CREATE TRIGGER ath_audit_events_no_delete
  BEFORE DELETE ON ath_audit_events
  FOR EACH ROW EXECUTE FUNCTION ath_forbid_mutation();

-- ---------------------------------------------------------------------------
-- Entitlements (schema only / manual beta)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ath_entitlements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES ath_organizations (id) ON DELETE CASCADE,
  product     TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('manual')),
  status      TEXT NOT NULL CHECK (status IN ('active', 'expired', 'revoked')),
  starts_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS ath_entitlements_updated_at ON ath_entitlements;
CREATE TRIGGER ath_entitlements_updated_at
  BEFORE UPDATE ON ath_entitlements
  FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();

-- ---------------------------------------------------------------------------
-- Notification stubs (no monitoring engine)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ath_notification_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES ath_organizations (id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES ath_users (id) ON DELETE CASCADE,
  channel     TEXT NOT NULL DEFAULT 'email',
  event_key   TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, channel, event_key)
);

CREATE TABLE IF NOT EXISTS ath_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES ath_organizations (id) ON DELETE SET NULL,
  user_id     UUID REFERENCES ath_users (id) ON DELETE SET NULL,
  event_key   TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Handoff replay + rate limits
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ath_claim_intents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce           TEXT NOT NULL UNIQUE,
  payload         JSONB NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ath_rate_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket      TEXT NOT NULL,
  rate_key    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ath_rate_events_lookup_idx
  ON ath_rate_events (bucket, rate_key, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS — defense in depth. Ask server is the only client.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ath_users', 'ath_auth_challenges', 'ath_sessions',
    'ath_organizations', 'ath_memberships', 'ath_hub_profiles',
    'ath_claims', 'ath_management_grants', 'ath_review_queue',
    'ath_audit_events', 'ath_entitlements',
    'ath_notification_preferences', 'ath_notifications',
    'ath_claim_intents', 'ath_rate_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS ath_server_all ON %I', t);
    EXECUTE format(
      'CREATE POLICY ath_server_all ON %I
         USING (ath_is_server())
         WITH CHECK (ath_is_server())',
      t
    );
  END LOOP;
END;
$$;

COMMENT ON TABLE ath_users IS 'AskTrustHub business-platform humans. Not CTH Home Passport. Not ownership.';
COMMENT ON TABLE ath_claims IS 'Historical authorization requests. Never a claimed boolean on a hub profile.';
COMMENT ON TABLE ath_management_grants IS 'Actual profile-management authorization. Email confirm is not a grant.';
COMMENT ON TABLE ath_audit_events IS 'Append-only authorization history.';
COMMENT ON TABLE ath_entitlements IS 'Manual beta capabilities only. Never influences evidence, ranking, or claim approval.';
COMMENT ON TABLE ath_hub_profiles IS 'Pointer to a specialist public profile. Layer A remains on the hub.';
