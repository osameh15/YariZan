-- Run with a separate migration operator. No login password is supplied here.
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='yarizan_runtime') THEN CREATE ROLE yarizan_runtime NOLOGIN; END IF; END $$;
GRANT USAGE ON SCHEMA public TO yarizan_runtime;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO yarizan_runtime;
REVOKE ALL ON schema_migrations FROM yarizan_runtime;
GRANT SELECT ON schema_migrations TO yarizan_runtime;
REVOKE UPDATE ON audit_logs,license_decisions,trial_starts,activation_redemptions,customer_reset_events,license_recoveries,admin_operations,payment_events FROM yarizan_runtime;
-- Bind a separately provisioned login to this role. Never grant CREATE, TRUNCATE or superuser.
