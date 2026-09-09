-- ATH-ADMIN-002. Ask-owned control-plane security only.
-- Staged in source; do not apply to permanent Production without the recovery gate.

CREATE TABLE IF NOT EXISTS ath_admin_staff(
  staff_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL UNIQUE REFERENCES ath_users(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK(role IN('SUPER_ADMIN','TRUST_OPS','DATA_OPS','GROWTH','READ_ONLY')),
  status TEXT NOT NULL CHECK(status IN('ACTIVE','DISABLED')), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES ath_users(id) ON DELETE RESTRICT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ, disabled_by UUID REFERENCES ath_users(id) ON DELETE RESTRICT, last_authorized_at TIMESTAMPTZ,
  CHECK((status='DISABLED')=(disabled_at IS NOT NULL))
);
DROP TRIGGER IF EXISTS ath_admin_staff_updated_at ON ath_admin_staff;
CREATE TRIGGER ath_admin_staff_updated_at BEFORE UPDATE ON ath_admin_staff FOR EACH ROW EXECUTE FUNCTION ath_set_updated_at();

CREATE TABLE IF NOT EXISTS ath_admin_audit_log(
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_staff_id UUID NOT NULL REFERENCES ath_admin_staff(staff_id) ON DELETE RESTRICT, actor_role TEXT NOT NULL,
  event_type TEXT NOT NULL, target_type TEXT NOT NULL, target_ref TEXT NOT NULL, reason_code TEXT NOT NULL,
  request_id TEXT NOT NULL, command_id UUID, result TEXT NOT NULL, before_state JSONB, after_state JSONB,
  authorization_context JSONB NOT NULL DEFAULT '{}'::jsonb, ip TEXT, user_agent TEXT
);
CREATE INDEX IF NOT EXISTS ath_admin_audit_log_time_idx ON ath_admin_audit_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS ath_admin_audit_log_target_idx ON ath_admin_audit_log(target_type,target_ref,occurred_at DESC);
CREATE OR REPLACE FUNCTION ath_forbid_admin_audit_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ath_admin_audit_log is append-only'; END; $$;
DROP TRIGGER IF EXISTS ath_admin_audit_no_update ON ath_admin_audit_log;
CREATE TRIGGER ath_admin_audit_no_update BEFORE UPDATE ON ath_admin_audit_log FOR EACH ROW EXECUTE FUNCTION ath_forbid_admin_audit_mutation();
DROP TRIGGER IF EXISTS ath_admin_audit_no_delete ON ath_admin_audit_log;
CREATE TRIGGER ath_admin_audit_no_delete BEFORE DELETE ON ath_admin_audit_log FOR EACH ROW EXECUTE FUNCTION ath_forbid_admin_audit_mutation();

CREATE TABLE IF NOT EXISTS ath_admin_commands(
  command_id UUID PRIMARY KEY, command_type TEXT NOT NULL, target_scope JSONB NOT NULL,
  actor_staff_id UUID NOT NULL REFERENCES ath_admin_staff(staff_id) ON DELETE RESTRICT, authorization_context JSONB NOT NULL,
  reason_code TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, requested_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK(status IN('PENDING','EXECUTING','SUCCEEDED','FAILED','ROLLED_BACK','REJECTED')),
  before_state_ref TEXT NOT NULL, intended_after_state TEXT NOT NULL, result JSONB, executed_at TIMESTAMPTZ,
  rollback_ref TEXT, audit_ref TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ath_control_flags(
  flag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), flag_key TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK(scope_type IN('network','hub','profile_class','jurisdiction','capability','campaign','feature')),
  scope_ref TEXT NOT NULL, scope_key TEXT NOT NULL, enabled BOOLEAN NOT NULL,
  connection_state TEXT NOT NULL CHECK(connection_state IN('CONNECTED','NOT_YET_CONNECTED')) DEFAULT 'NOT_YET_CONNECTED',
  reason_code TEXT NOT NULL, changed_by UUID NOT NULL REFERENCES ath_admin_staff(staff_id) ON DELETE RESTRICT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(), version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  UNIQUE(flag_key,scope_key)
);

CREATE TABLE IF NOT EXISTS ath_admin_break_glass_requests(
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), requested_by UUID NOT NULL REFERENCES ath_admin_staff(staff_id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL, reason_code TEXT NOT NULL, target_type TEXT NOT NULL, target_ref TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN('REQUESTED','APPROVED','REJECTED','EXPIRED','REVOKED')) DEFAULT 'REQUESTED',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL,
  resolved_by UUID REFERENCES ath_admin_staff(staff_id) ON DELETE RESTRICT, resolved_at TIMESTAMPTZ
);

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['ath_admin_staff','ath_admin_audit_log','ath_admin_commands','ath_control_flags','ath_admin_break_glass_requests'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS ath_server_all ON %I',t);
  EXECUTE format('CREATE POLICY ath_server_all ON %I USING (ath_is_server()) WITH CHECK (ath_is_server())',t);
  EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',t);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM anon',t); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated',t); END IF;
END LOOP; END; $$;

COMMENT ON TABLE ath_admin_staff IS 'Named staff authorization, separate from consumer, organization, claim and management authority.';
COMMENT ON TABLE ath_admin_audit_log IS 'Append-only privileged control-plane audit history. Never store secrets, tokens, private notes or decisions.';
COMMENT ON TABLE ath_admin_commands IS 'Idempotent admin_command.v1 persistence; execution requires an explicitly connected handler.';
COMMENT ON TABLE ath_control_flags IS 'Authoritative reversible intent; NOT_YET_CONNECTED does not alter product behavior.';
