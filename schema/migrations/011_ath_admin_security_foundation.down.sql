-- Development reversal only. Production rollback should restore the prior application before schema removal.
DROP TABLE IF EXISTS ath_admin_break_glass_requests;
DROP TABLE IF EXISTS ath_control_flags;
DROP TABLE IF EXISTS ath_admin_commands;
DROP TABLE IF EXISTS ath_admin_audit_log;
DROP TABLE IF EXISTS ath_admin_staff;
DROP FUNCTION IF EXISTS ath_forbid_admin_audit_mutation();
